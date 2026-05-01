# QuoteFlow — 05: Frontend Design

> Load this file when: working on React apps, UI components, screens, or frontend logic

---

## Two Separate React Applications

QuoteFlow has two completely separate React apps — not one app with different routes.

**Why separate:** The supplier portal must be simple enough for someone who has never heard of QuoteFlow. No shared nav, no shared auth, no shared complexity. A supplier receives an email, clicks a link, fills a form, submits. That's the entire experience. Mixing it with the buyer portal would create confusion.

Both apps are containerized with Docker and deployed to separate Cloud Run services.

---

## Buyer Portal

### Application Structure

```
buyer-portal/
├── src/
│   ├── pages/
│   │   ├── Login.tsx             — Email/password login
│   │   ├── Register.tsx          — Account and org creation
│   │   ├── Dashboard.tsx         — All RFQ events list
│   │   ├── NewRFQ.tsx            — RFQ creation chat flow
│   │   ├── RFQDetail.tsx         — Active event with supplier status
│   │   ├── Analysis.tsx          — Scoring and comparison table
│   │   ├── Memo.tsx              — Decision memo view and PDF export
│   │   └── Suppliers.tsx         — Supplier contact management
│   ├── components/
│   │   ├── ChatInterface.tsx     — The conversation UI for RFQ creation
│   │   ├── RFQPreview.tsx        — Generated document preview panel
│   │   ├── SupplierTable.tsx     — Response comparison table
│   │   ├── ScoreCard.tsx         — Per-supplier score breakdown
│   │   ├── FlagBadge.tsx         — Compliance flag display (red/yellow)
│   │   ├── CriteriaBuilder.tsx   — Set evaluation weights (must sum to 100%)
│   │   ├── RatingInput.tsx       — Buyer rates subjective criteria (1-5 stars)
│   │   └── StatusBadge.tsx       — RFQ/invitation status indicator
│   ├── hooks/
│   │   ├── useRFQ.ts             — RFQ CRUD operations
│   │   ├── useSuppliers.ts       — Supplier management
│   │   └── useAnalysis.ts        — Normalization, scoring, memo
│   ├── lib/
│   │   ├── api.ts                — Axios instance with auth header
│   │   └── auth.ts               — JWT storage and retrieval
│   └── main.tsx
├── Dockerfile                    — Multi-stage: node build → nginx serve
└── nginx.conf                    — Proxy /api to backend Cloud Run URL
```

### Key Screen Descriptions

**Dashboard (`/`)** — Card grid showing all RFQ events. Each card shows: title, category, status badge (draft/active/closed/awarded), deadline countdown, response count vs invited count (e.g. "3/8 responded"). Quick action buttons: View, Close, Duplicate. Empty state prompts to create first RFQ.

**NewRFQ (`/rfq/new`)** — Two-panel layout. Left: chat interface for conversation. Right: RFQ document preview that appears once the conversation completes. Chat shows buyer messages on the right in blue, assistant messages on the left in gray. Loading dots appear when AI is processing. When conversation is complete, the document appears in the right panel with an Edit button and an Approve button. Approving shows a modal to set deadline, select suppliers, and set evaluation criteria weights.

**RFQDetail (`/rfq/{id}`)** — Two-column layout. Left column: RFQ document (read-only), event metadata, deadline countdown. Right column: supplier invitation list with status for each (invited / viewed / responded / declined / bounced). Shows time remaining until deadline. "Analyze Responses" button appears when at least one response has been submitted. Q&A tab shows supplier questions and buyer answers.

**Analysis (`/rfq/{id}/analysis`)** — Three sections stacked vertically:
1. Eliminated suppliers — red-bordered cards showing each eliminated supplier and exact reason
2. Qualifying suppliers — ranked comparison table with scores, prices, timelines
3. Scoring breakdown — per-criterion scores for each qualifying supplier, with rating inputs for buyer-rated criteria

"Generate Memo" button activates when all buyer-rated criteria have a rating entered.

**Memo (`/rfq/{id}/memo`)** — Displays the generated memo text with clear section headers. "Download PDF" button. "Award to [Supplier Name]" button that marks the RFQ as awarded and records the winning supplier.

**Suppliers (`/suppliers`)** — Table with columns: Name, Email, Categories, Response Rate, Last Used, Actions. Add Supplier button opens a modal. Import CSV link. "Find vendors for [category]" button opens a filtered panel from the vendor directory.

### State Management

**Server state:** React Query. API responses are cached and automatically invalidated. Loading and error states handled automatically. No manual loading state management needed.

**Form state:** React Hook Form with Zod validation schemas. Matches the Pydantic schemas on the backend.

**Global UI state:** Simple React useState. Modals, toasts, sidebar open/closed. No Redux, no Zustand — not needed at this complexity level.

### API Client

`lib/api.ts` — Axios instance with base URL pointing to the backend Cloud Run service. JWT token automatically added to every request from localStorage. On 401 response, clears token and redirects to login.

```typescript
// Buyer portal environment variable
VITE_API_URL=https://quoteflow-api-{hash}.run.app
```

### Docker Setup — Buyer Portal

Multi-stage Dockerfile:
- **Stage 1 (build):** `node:20-alpine` — installs dependencies, runs `npm run build`, outputs static files to `/app/dist`
- **Stage 2 (serve):** `nginx:alpine` — copies static files, runs nginx

Nginx config:
- Serves static files from `/app/dist`
- Proxies `/api/*` requests to the backend Cloud Run URL (set as nginx env variable)
- Returns `index.html` for all non-asset routes (enables React Router)

---

## Supplier Portal

### Application Structure

```
supplier-portal/
├── src/
│   ├── pages/
│   │   ├── ResponseForm.tsx      — Main response page (the entire product)
│   │   ├── Confirmation.tsx      — Success screen after submit
│   │   └── InvalidLink.tsx       — Token expired, invalid, or already submitted
│   ├── components/
│   │   ├── RFQViewer.tsx         — Read-only RFQ document display
│   │   ├── FormField.tsx         — Dynamic field renderer (handles all field types)
│   │   ├── FileUpload.tsx        — Drag-and-drop with progress indicator
│   │   └── QuestionBox.tsx       — Ask buyer a clarification question
│   └── main.tsx
├── Dockerfile                    — Same multi-stage pattern as buyer portal
└── nginx.conf
```

### Design Principles

- **No account creation.** The supplier clicks a link and lands directly on the form.
- **No navigation.** There is no header nav, no sidebar, no other pages to go to.
- **No jargon.** Labels and hints are written for someone who has never used QuoteFlow.
- **Mobile-first.** Many suppliers will open the link on a phone. Every field must work on mobile.
- **Clear progress.** Show how many required fields remain. Make it obvious when the form is ready to submit.

### ResponseForm.tsx — The Core Page

Loaded from token in URL: `GET /api/response/{token}`

On load:
1. Fetch RFQ data and form structure from API using token
2. Mark invitation as "viewed" in database (API does this automatically)
3. Render RFQ document in a collapsible panel at top
4. Render dynamic form below
5. Render Q&A section at bottom (shows answered questions, input for new question)

The form is **dynamically generated** from the `response_form_fields` array in the category template. The frontend does not have hardcoded fields — it renders whatever the template defines. This means adding a new template category automatically works without frontend changes.

Field types rendered by `FormField.tsx`:
- `text` — single line input with label and hint
- `textarea` — multi-line with word count display
- `number` — numeric input with currency symbol or unit label
- `dropdown` — select from predefined options array
- `url_list` — repeatable URL input fields with add/remove buttons
- `file_upload` — drag-and-drop zone, shows file name and size after selection
- `boolean` — yes/no radio buttons

On submit:
1. Client-side validate all required fields
2. Upload files to GCS via presigned upload URL (get URL from API first, upload directly to GCS)
3. POST form data to `/api/response/{token}` including GCS file paths
4. On success: redirect to Confirmation page
5. Token is now invalid — cannot submit again

### Confirmation.tsx

Simple screen: green checkmark, "Response submitted" heading, summary of key submitted values (price, timeline), and a note that the buyer will be in touch.

### InvalidLink.tsx

Shown when:
- Token not found in database
- Deadline has passed
- Response already submitted

Each case shows a different message explaining what happened.

---

## Shared Frontend Concerns

### Environment Variables

Buyer portal: `VITE_API_URL` — backend Cloud Run URL
Supplier portal: `VITE_API_URL` — same backend Cloud Run URL

Both set as Cloud Run environment variables, injected into nginx config at container startup.

### Error Handling

API errors caught by React Query and displayed as toast notifications. Form validation errors shown inline below each field. Network errors shown as a banner with a retry button.

### Accessibility

All interactive elements must be keyboard navigable. Form fields must have associated labels. Error messages must be programmatically associated with their fields. Color is never the only indicator of state (use icons + color).

### Build Output

Both portals produce a static build output — HTML, CSS, and JS files. These are served by nginx with no server-side rendering. All routing is client-side via React Router.

---

*See 00-INDEX.md for the full file map*
