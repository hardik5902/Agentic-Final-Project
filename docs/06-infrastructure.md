# QuoteFlow — 06: Infrastructure and Analysis Pipeline

> Load this file when: working on email, file storage, background jobs, response normalization, scoring, or memo generation

---

## Email System (SendGrid)

### Email Types and Triggers

| Email | Trigger | Recipient | Sent by |
|---|---|---|---|
| Supplier invitation | RFQ approved | Each invited supplier | Cloud Task |
| Deadline reminder (3 days) | Cloud Scheduler daily job | Non-responding suppliers | Cloud Task |
| Deadline reminder (1 day) | Cloud Scheduler daily job | Non-responding suppliers | Cloud Task |
| Response received | Supplier submits | Buyer | Cloud Task |
| All responses in | Last supplier submits | Buyer | Cloud Task |
| Deadline passed | Cloud Scheduler daily job | Buyer | Cloud Task |

### Supplier Invitation Email

Content:
- From: `rfq@quoteflow.com` (verified SendGrid domain)
- Subject: `RFQ: {rfq_title} — Response requested by {deadline}`
- Body: Buyer company name, RFQ title, deadline, large CTA button linking to supplier portal, note that no account is required
- Plain text fallback for clients that block HTML

The portal link format: `https://respond.quoteflow.com/{token}`

### Email Deliverability

- SPF record configured for `quoteflow.com`
- DKIM signing enabled in SendGrid
- Bounced emails trigger `invitation.status = 'bounced'` and a buyer notification
- SendGrid open and click tracking enabled for analytics

### SendGrid Tier

Start with Essentials ($19.95/month) to remove SendGrid branding from emails. The free tier (100/day) is sufficient during development only.

---

## File Storage (Google Cloud Storage)

### Bucket Structure

One bucket per environment (`quoteflow-dev`, `quoteflow-prod`). All objects are private — never publicly accessible.

```
gs://quoteflow-prod/
  rfq-documents/
    {rfq_id}/
      rfq.pdf               — generated RFQ document
      {buyer_uploaded_file} — buyer attachments
  decision-memos/
    {rfq_id}/
      memo.pdf              — generated decision memo
  supplier-responses/
    {response_id}/
      {supplier_uploaded_file} — certificates, portfolios, etc.
```

### Access Pattern

The database stores GCS object paths (e.g., `rfq-documents/abc-123/rfq.pdf`) — not public URLs.

When a buyer or supplier needs to download a file:
1. API receives the download request
2. API verifies the requester has permission to access that file
3. API generates a signed URL with 1-hour expiry
4. API returns the signed URL to the client
5. Client downloads directly from GCS using the signed URL

This ensures files are never accessible without authorization.

### Authentication

The Cloud Run service account has `roles/storage.objectAdmin` on the bucket. The `google-cloud-storage` Python client uses ambient GCP credentials — no explicit key setup in code.

```python
from google.cloud import storage
client = storage.Client()  # uses service account credentials automatically
```

### File Validation

Before uploading any file:
- Check content type is in allowed list: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`, `image/png`, `video/mp4`
- Check file size does not exceed 25MB
- Validation happens in `storage_service.py` before the GCS upload call

### Direct Upload for Large Files

For files over 5MB, use GCS signed upload URLs to upload directly from the browser to GCS — bypassing the Cloud Run API. Flow:
1. Client requests a signed upload URL from API (POST /api/upload/request)
2. API generates signed URL and returns it
3. Client uploads file directly to GCS using the signed URL
4. Client notifies API of the GCS object path (POST /api/upload/confirm)
5. API records the object path in the database

This avoids large files going through Cloud Run and hitting memory limits.

---

## Background Jobs (Cloud Tasks + Cloud Scheduler)

### Why Not Celery

The original plan used Celery. On GCP, Cloud Tasks replaces it. Key advantages:
- No Celery worker process to deploy and maintain
- No Redis needed just for queuing (Memorystore still used for caching)
- Cloud Tasks handles retries automatically
- The same Cloud Run API service handles both web requests and task execution

### How Cloud Tasks Works

```
Route handler creates a Cloud Tasks HTTP task:
  queue: "quoteflow-tasks"
  method: POST
  url: https://quoteflow-api-{hash}.run.app/internal/tasks/{task_name}
  body: {task-specific JSON payload}
  headers: includes OIDC token for authentication

Cloud Tasks executes the task (immediately or after delay):
  → HTTP POST to internal task endpoint
  → Task handler runs the service function
  → Returns 200 on success
  → Returns 5xx on failure → Cloud Tasks retries (up to 3 times)
```

### Cloud Tasks Queue Configuration

```
Queue name: quoteflow-tasks
Location: same region as Cloud Run
Max concurrent dispatches: 100
Max attempts: 3
Min backoff: 10 seconds
Max backoff: 300 seconds
Max doublings: 3
```

### Task Definitions

**send-invitation**
- Trigger: RFQ approval (one task per supplier)
- Payload: `{invitation_id, supplier_email, supplier_name, rfq_title, deadline, portal_token, buyer_company}`
- Action: Send invitation email via SendGrid, update `invitation.email_sent_at`

**generate-pdf**
- Trigger: RFQ document generation complete or memo generation complete
- Payload: `{rfq_id, type: "rfq"|"memo", content: "text content"}`
- Action: WeasyPrint converts text to PDF, upload to GCS, update database URL field

**notify-response-received**
- Trigger: Supplier submits response
- Payload: `{rfq_id, supplier_name, response_count, invited_count, buyer_email, buyer_name}`
- Action: Send notification email to buyer. If response_count == invited_count, send "all in" email instead

**update-supplier-stats**
- Trigger: After invitation sent or response received
- Payload: `{supplier_id}`
- Action: Recalculate total_invitations, total_responses, response_rate, avg_response_days

**send-deadline-reminder**
- Trigger: Cloud Scheduler daily job
- Payload: `{invitation_id, days_remaining}`
- Action: Send reminder email if not already sent (check reminder_1_sent_at or reminder_2_sent_at)

### Cloud Scheduler Jobs

**daily-deadline-reminders**
- Schedule: `0 9 * * *` (9am UTC daily)
- Target: `POST /internal/tasks/check-reminders`
- Action: Query active RFQs with deadlines in 1 or 3 days, create individual send-deadline-reminder tasks per non-responding supplier

---

## Response Normalization

All normalization is deterministic Python — no AI. Takes `raw_data` (exactly what supplier submitted) and produces `normalized_data` plus a `flags` list.

### Normalization Steps

**Step 1 — Currency conversion**

All prices converted to USD at the exchange rate on the day of response submission. Rate fetched from ExchangeRate-API and cached in Memorystore (Redis key: `exchange_rate:{from}:USD:{date}`, TTL: 24 hours). Original currency and rate stored in `normalized_data` for audit.

Suppliers in China often quote in CNY, Europe in EUR, UK in GBP. All converted before any price comparison.

**Step 2 — Lead time standardization**

All time values converted to calendar weeks. Recognized units: days, weeks, months, business days, working days.

Conversion table:
- 1 day = 1/7 weeks
- 1 week = 1 week
- 1 month = 30/7 weeks ≈ 4.29 weeks
- 1 business day = 1.4/7 weeks (assumes 5 business days per 7 calendar days)

**Step 3 — Landed cost estimation**

If incoterm is EXW or FOB: add estimated freight cost per unit based on origin country lookup table.
If incoterm is DDP, DAP, CIF, or CFR: freight is included in quoted price, add zero.

Freight estimates by origin country (USD per unit, rough approximation):
```
CN (China): $0.18    MX (Mexico): $0.08
IN (India): $0.22    DE (Germany): $0.12
US (domestic): $0.02  GB (UK): $0.14
DEFAULT: $0.15
```

Total landed cost = (unit_price_usd + freight_per_unit) × quantity

**Step 4 — Revision cost normalization**

If supplier included fewer revision rounds than buyer's minimum requirement:
`effective_revision_cost = (required_rounds - included_rounds) × additional_cost_per_round`

This ensures a supplier with 1 included round and $500 additional is compared fairly to a supplier with 2 included rounds.

**Step 5 — Effective total cost**

`effective_total_cost = landed_cost_total + effective_revision_cost`

This is the number used for price scoring — not the raw quoted price.

**Step 6 — Compliance flag checks**

Check against `rfq_events.requirements`:

Hard eliminations (eliminates supplier from scoring):
- `effective_total_cost > budget_max` → flag type "hard_elimination"
- `timeline_weeks > timeline_max_weeks` → flag type "hard_elimination"

Soft warnings (shown to buyer, does not eliminate):
- `len(portfolio_links) < min_portfolio_examples` → flag type "warning"
- `effective_total_cost < (median_price × 0.60)` → flag type "warning" (unusually low)
- Required certification document not uploaded → flag type "warning"

Eliminated suppliers are excluded from scoring but shown separately in the Analysis view with their elimination reason.

---

## Scoring Engine

Pure Python arithmetic. No AI. Auditable and deterministic.

### Criteria Types

**Calculated criteria** — scored automatically from `normalized_data`. No buyer input needed.
- `price`: lower is better
- `timeline`: faster is better

**Buyer-rated criteria** — buyer assigns 1–5 rating after reviewing responses.
- `proposed_approach`, `portfolio_relevance`, `team_experience`, etc.

The buyer must rate all buyer-rated criteria before the memo can be generated.

### Scoring Formula

Each criterion produces a score from 0–100. Final score = weighted sum across all criteria.

**Calculated — price:**
```
best_price = min(effective_total_cost for all qualifying suppliers)
score = (best_price / supplier_price) × 100
```
Supplier with lowest price gets 100. Supplier 20% more expensive gets 83.3.

**Calculated — timeline:**
```
best_timeline = min(timeline_weeks for all qualifying suppliers)
score = (best_timeline / supplier_timeline) × 100
```
Fastest supplier gets 100.

**Buyer-rated:**
```
score = (rating / 5) × 100
```
Rating of 5 → 100 points. Rating of 3 → 60 points. Rating of 1 → 20 points.

**Final score:**
```
final_score = sum(criterion_score × criterion_weight for all criteria)
```

Weights must sum to 1.0. Enforced by the API when criteria are set.

### Default Weights by Category

**Professional Services:**
- proposed_approach: 0.30
- portfolio_relevance: 0.25
- price: 0.25
- timeline: 0.10
- team_experience: 0.10

**SaaS Tools:**
- features_match: 0.30
- price: 0.30
- implementation_timeline: 0.20
- support_quality: 0.10
- contract_flexibility: 0.10

Buyers can adjust weights in the Analysis screen before scoring runs.

---

## Decision Memo Generation

### What the Memo Contains

350–500 word document with five required sections:

1. **Recommendation** — winning supplier, score, price, timeline
2. **Eliminated Suppliers** — one sentence per eliminated supplier, specific reason
3. **Evaluation Summary** — compare top 2–3 qualifiers, quantify tradeoffs
4. **Risk Considerations** — risks with the recommendation
5. **Recommended Next Steps** — 2–3 concrete actions

### Generation Process

1. API receives POST `/api/analysis/{rfq_id}/memo`
2. Verify all buyer-rated criteria have ratings
3. Compile scored results, eliminated suppliers, criteria into input dict
4. Call `ai_service.generate_decision_memo(input_dict)` → returns memo text string (via `memo_agent` ADK runner, Vertex AI `gemini-2.0-flash`)
5. Create Cloud Task for PDF generation
6. Save memo text to `rfq_events.memo_text`
7. Return memo text to buyer immediately (PDF URL follows async)

### PDF Generation (Cloud Task)

WeasyPrint converts the memo text to a styled PDF:
- Header: QuoteFlow logo, RFQ title, date
- Body: Memo text formatted with clear section headers (bold)
- Font: clean system sans-serif
- Page: A4, standard margins

PDF uploaded to `decision-memos/{rfq_id}/memo.pdf` in GCS. `rfq_events.memo_pdf_url` updated with the GCS object path. API generates a signed URL when buyer clicks "Download PDF".

### Category Template System — Full Structure

```json
{
  "category_id": "string",
  "category_name": "string",
  "subcategories": ["string"],
  "required_fields": ["string"],
  "optional_fields": ["string"],
  "response_form_fields": [
    {
      "field_id": "string",
      "label": "string",
      "type": "text|textarea|number|dropdown|url_list|file_upload|boolean",
      "required": true,
      "hint": "string",
      "options": ["string"],      // for dropdown type
      "min_count": 2,             // for url_list type
      "max_words": 300            // for textarea type
    }
  ],
  "normalization_rules": {
    "field_id": {"type": "currency_convert|time_standardize|revision_normalize"}
  },
  "default_evaluation_criteria": [
    {"name": "string", "label": "string", "weight": 0.30, "type": "calculated|buyer_rated"}
  ],
  "compliance_checks": [
    {"check": "budget_compliance", "eliminates": true, "message": "string"},
    {"check": "timeline_compliance", "eliminates": true, "message": "string"},
    {"check": "portfolio_minimum", "eliminates": false, "message": "string"}
  ]
}
```

### Vendor Directory

A curated reference list of vendor contacts. Not a marketplace — vendors do not sign up. Used when a buyer has no existing supplier contacts for a category.

Population:
- Initial: manually curated from Clutch, G2, LinkedIn (20–50 per category)
- Customer contributions: buyers can add suppliers to the shared directory
- Organic: suppliers who respond well accumulate performance data

The vendor directory is shared across all organizations. The supplier database (in the `suppliers` table) is private per organization.

Discovery endpoint: `GET /api/suppliers/discover?category={category}&country={country}&limit=10` — returns top-rated vendors from the directory filtered by category.

---

*See 00-INDEX.md for the full file map*
