# QuoteFlow — 07: Deployment and Security

> Load this file when: deploying to GCP, setting up Docker, configuring Cloud Run, working on auth/security, or following the build timeline

---

## Authentication and Security

### Buyer Authentication — JWT

Standard JWT (JSON Web Token) flow:
1. Buyer registers or logs in with email + password
2. API returns a signed JWT token (expires 7 days)
3. Frontend stores token in localStorage
4. Every subsequent request includes: `Authorization: Bearer {token}`
5. FastAPI dependency `get_current_user()` decodes token and loads user

Password storage: bcrypt hash. Never store plain text passwords. Never log passwords.

JWT signing key: stored in Secret Manager as `SECRET_KEY`. 64 random characters. Never in code or `.env` files in production.

### Supplier Portal Access — Invitation Token

No login required. Token is the credential.

- Each invitation generates a 64-character URL-safe random token
- Stored in `invitations.token` column with unique constraint
- Token embedded in supplier portal URL: `https://respond.quoteflow.com/{token}`
- API validates token on every supplier portal request
- Token becomes invalid after response is submitted (`status = 'responded'`)
- Expired deadline also invalidates the token

### Cloud Tasks Authentication — OIDC

Internal task endpoints use OIDC token verification:
1. Cloud Tasks creates task with OIDC token from its service account
2. Task HTTP request includes `Authorization: Bearer {oidc_token}` header
3. FastAPI middleware on `/internal/*` routes verifies the OIDC token
4. Verifies token audience matches this Cloud Run service URL
5. Cloud Run ingress settings restrict `/internal/*` paths to internal GCP traffic only — public internet cannot reach these paths regardless of token

### Organization Data Isolation

**This is the most critical security rule.** Every database query that touches buyer data must include a `WHERE org_id = {current_user.org_id}` filter. Without this, one buyer could access another's RFQs.

Enforced in: every service function. Never rely on the router to do this.

Pattern:
```python
# In every service function:
rfq = db.query(RFQEvent).filter(
    RFQEvent.id == rfq_id,
    RFQEvent.org_id == current_user.org_id  # always include this
).first()
if not rfq:
    raise HTTPException(404)  # 404 not 403 — don't reveal existence
```

Using 404 instead of 403 prevents information leakage about whether a resource exists.

### Input Validation

All inputs validated by Pydantic v2 schemas before reaching service layer. Invalid inputs return 422 with field-level error details. File uploads validated server-side for type (allowlist) and size (25MB max) before upload to GCS.

### Rate Limiting

Redis-based (Memorystore). Applied as FastAPI middleware:
- Auth endpoints (`/api/auth/*`): 5 requests per minute per IP — prevents brute force
- Supplier portal endpoints: 10 requests per minute per token — prevents scraping
- All other authenticated endpoints: 60 requests per minute per user

### HTTPS

Cloud Run enforces HTTPS automatically. HTTP requests are redirected. All Cloud Run service URLs are HTTPS-only.

### CORS

`Access-Control-Allow-Origin` restricted to exact buyer portal and supplier portal Cloud Run URLs. Wildcard `*` is never used in production. Configured in FastAPI middleware.

### Secrets

All secrets stored in GCP Secret Manager. Zero secrets in:
- Source code
- `.env` files committed to git
- Docker images
- CI/CD pipeline environment variables
- Cloud Run environment variables (use Secret Manager references instead)

In Cloud Run, secrets are mounted as environment variables via Secret Manager references — Cloud Run fetches them at startup. The service account needs `roles/secretmanager.secretAccessor`.

---

## GCP Setup — Before Writing Code

Complete these steps before starting development. They cannot be done later without disruption.

### 1. Create GCP Project

```bash
gcloud projects create quoteflow-prod --name="QuoteFlow"
gcloud config set project quoteflow-prod
gcloud billing accounts list  # find your billing account ID
gcloud billing projects link quoteflow-prod --billing-account={BILLING_ACCOUNT_ID}
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 3. Create Service Account

```bash
gcloud iam service-accounts create quoteflow-api \
  --display-name="QuoteFlow API Service Account"

# Grant required roles
gcloud projects add-iam-policy-binding quoteflow-prod \
  --member="serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding quoteflow-prod \
  --member="serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
  # Required for both Google ADK and direct Vertex AI (gemini-2.0-flash) calls

gcloud projects add-iam-policy-binding quoteflow-prod \
  --member="serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding quoteflow-prod \
  --member="serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding quoteflow-prod \
  --member="serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### 4. Create Cloud SQL Instance

```bash
gcloud sql instances create quoteflow-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-east5 \
  --storage-size=10GB \
  --backup-start-time=02:00

gcloud sql databases create quoteflow \
  --instance=quoteflow-db

gcloud sql users create quoteflow-user \
  --instance=quoteflow-db \
  --password={STRONG_PASSWORD}
```

### 5. Create Memorystore (Redis)

```bash
gcloud redis instances create quoteflow-redis \
  --size=1 \
  --region=us-east5 \
  --tier=BASIC
```

### 6. Create GCS Bucket

```bash
gsutil mb -p quoteflow-prod -c STANDARD -l us-east5 gs://quoteflow-prod-files
gsutil iam ch serviceAccount:quoteflow-api@quoteflow-prod.iam.gserviceaccount.com:objectAdmin gs://quoteflow-prod-files
```

### 7. Create Artifact Registry

```bash
gcloud artifacts repositories create quoteflow \
  --repository-format=docker \
  --location=us-east5
```

### 8. Create Cloud Tasks Queue

```bash
gcloud tasks queues create quoteflow-tasks \
  --location=us-east5 \
  --max-concurrent-dispatches=100 \
  --max-attempts=3 \
  --min-backoff=10s \
  --max-backoff=300s
```

### 9. Store Secrets in Secret Manager

```bash
# For each secret:
echo -n "your-secret-value" | gcloud secrets create SECRET_NAME \
  --data-file=- \
  --replication-policy=automatic

# Secrets to create:
# DATABASE_URL
# REDIS_URL
# GCP_PROJECT_ID
# GCP_REGION
# GCS_BUCKET_NAME
# SENDGRID_API_KEY
# EXCHANGE_RATE_API_KEY
# SECRET_KEY (generate 64 random chars)
# FRONTEND_URL
# SUPPLIER_PORTAL_URL
```

---

## Docker Setup

### Backend Dockerfile

```dockerfile
FROM python:3.12-slim

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Frontend Dockerfile (buyer and supplier portal — same pattern)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf for Frontend

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    # Proxy API calls to backend
    location /api/ {
        proxy_pass ${API_URL}/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # All other routes serve index.html (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker Compose for Local Development

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: quoteflow
      POSTGRES_PASSWORD: localpassword
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## Production Deployment — Cloud Run

Three Cloud Run services:

**quoteflow-api** — FastAPI backend
```
Image: us-east5-docker.pkg.dev/quoteflow-prod/quoteflow/api:latest
Memory: 512MB
CPU: 1
Min instances: 0 (scale to zero when idle)
Max instances: 10
Concurrency: 80 requests per instance
Service account: quoteflow-api@quoteflow-prod.iam.gserviceaccount.com
Cloud SQL connections: quoteflow-prod:us-east5:quoteflow-db
Secrets: all secrets mounted as environment variables
Ingress: All (allow public traffic on /api/* and /internal/* blocked separately)
```

**quoteflow-buyer** — Buyer portal
```
Image: us-east5-docker.pkg.dev/quoteflow-prod/quoteflow/buyer:latest
Memory: 256MB
CPU: 1
Min instances: 0
Max instances: 5
Environment: API_URL=https://quoteflow-api-{hash}.run.app
Ingress: All (public)
```

**quoteflow-supplier** — Supplier portal
```
Image: us-east5-docker.pkg.dev/quoteflow-prod/quoteflow/supplier:latest
Memory: 256MB
CPU: 1
Min instances: 0
Max instances: 5
Environment: API_URL=https://quoteflow-api-{hash}.run.app
Ingress: All (public)
```

---

## CI/CD Pipeline — Cloud Build

Trigger: push to `main` branch on GitHub.

`cloudbuild.yaml` steps:
1. Build backend Docker image
2. Push to Artifact Registry
3. Deploy backend to Cloud Run
4. Run database migrations (Cloud Run Job)
5. Build buyer portal Docker image
6. Push to Artifact Registry
7. Deploy buyer portal to Cloud Run
8. Build supplier portal Docker image
9. Push to Artifact Registry
10. Deploy supplier portal to Cloud Run

Total deploy time: 4–6 minutes from git push to live. Zero-downtime — Cloud Run keeps old version running until new version passes health checks.

---

## Infrastructure Cost With GCP Credits

| Service | Monthly Cost | Notes |
|---|---|---|
| Cloud Run (3 services) | ~$2 | Scale to zero, very low at early stage |
| Cloud SQL | ~$7 | db-f1-micro, smallest instance |
| Memorystore | ~$16 | 1GB basic tier, smallest available |
| Google Cloud Storage | ~$0.50 | First 5GB |
| Vertex AI (gemini-2.0-flash + ADK) | ~$1–2 | ~$0.01-0.03 per RFQ event (Flash is cheaper) |
| Cloud Tasks + Scheduler | ~$0 | Free tier covers early usage |
| Secret Manager | ~$0 | Free tier covers early usage |
| Cloud Build | ~$0 | 120 free build-minutes per day |
| Artifact Registry | ~$0.50 | Docker image storage |
| **Total GCP** | **~$31/month** | Covered by GCP credits |
| SendGrid | $19.95 | Essentials plan |
| ExchangeRate-API | $0 | Free tier |
| Sentry | $0 | Free tier |
| PostHog | $0 | Free tier |
| Domain | $1 | Amortized |
| **Total out of pocket** | **~$21/month** | While credits active |

---

## Cloud Monitoring Alerts

Configure in Cloud Monitoring before launch:

| Alert | Threshold | Severity |
|---|---|---|
| Cloud Run error rate | > 1% for 5 minutes | Critical |
| Cloud Run p99 latency | > 5 seconds | Warning |
| Cloud SQL CPU | > 80% for 5 minutes | Warning |
| Cloud SQL disk | > 80% used | Warning |
| Vertex AI spend | > $50/month | Budget alert |
| GCS bucket size | > 10GB | Informational |

---

## 12-Week Build Timeline

### GCP Prerequisites (before Week 1)
Complete the GCP Setup section above. Should take one day.

### Week 1 — Foundation
- Write all three category template JSON files — do this first
- Set up Docker Desktop, Python 3.12, Node 20 locally
- Set up local PostgreSQL and Redis via Docker Compose
- Database schema created and migrations run
- FastAPI project structure with health endpoint
- Write Dockerfile for backend — verify `docker build` succeeds
- **Deliverable:** `docker build` succeeds, `curl /health` returns 200

### Week 2 — Authentication and Basic API
- User registration and login endpoints
- JWT token generation and validation
- Organization creation on registration
- Protected route middleware
- Connect to Cloud SQL locally via Cloud SQL Auth Proxy
- **Deliverable:** Can register, login, get JWT token against Cloud SQL

### Week 3 — AI Engine with Google ADK + Vertex AI
- Run `gcloud auth application-default login` for local ADK and Vertex AI access
- Install `google-adk` and `google-cloud-aiplatform` packages
- Initialise Vertex AI with `gemini-2.0-flash` in `ai_service.py`
- Define three ADK agents (`rfq_conversation_agent`, `rfq_generation_agent`, `memo_agent`)
- Category identification (direct Vertex AI call)
- Clarifying question generation loop via ADK `Runner`
- Field extraction registered as an ADK tool on the conversation agent
- RFQ document generation via ADK single-turn agent
- **Deliverable:** POST description → receive complete RFQ document via Postman using ADK + Vertex AI

### Week 4 — RFQ Flow
- RFQ approval endpoint
- Invitation creation and token generation
- Supplier model and management endpoints
- **Deliverable:** Full RFQ lifecycle in Cloud SQL, tokens generated

### Week 5 — Email and File Storage
- SendGrid integration and email templates
- Google Cloud Storage setup via `google-cloud-storage` client
- PDF generation via WeasyPrint, stored in GCS
- Cloud Tasks queue — first task created and handled
- **Deliverable:** Invitation emails sent, files stored in GCS via Cloud Tasks

### Week 6 — Supplier Portal
- Supplier portal React app with Dockerfile
- Dynamic form generation from template JSON
- File upload to GCS
- Response submission endpoint
- **Deliverable:** Supplier receives email, opens link, submits response with files

### Week 7 — Buyer Portal Core
- Buyer portal React app with Dockerfile
- Login and registration screens
- Dashboard with RFQ event cards
- Chat interface for RFQ creation
- **Deliverable:** Buyer creates RFQ through chat UI in Docker locally

### Week 8 — Buyer Portal Complete
- RFQ approval flow with deadline/criteria setting
- Supplier selection and invitation trigger
- RFQ detail view with invitation status
- Supplier management page
- **Deliverable:** Complete creation-to-invitation flow in browser

### Week 9 — Normalization and Scoring
- Response normalization service with Memorystore caching
- Compliance flag checking
- Scoring engine
- Buyer rating inputs in Analysis UI
- **Deliverable:** Comparison table with scores visible after supplier responses

### Week 10 — Decision Memo and Analysis UI
- Decision memo generation via Vertex AI
- PDF export stored in GCS
- Analysis page in buyer portal
- Eliminated vs qualifying supplier sections
- **Deliverable:** End-to-end demo from description to decision memo

### Week 11 — Production Hardening
- Cloud Scheduler for daily deadline reminder job
- Secret Manager — all secrets moved out of `.env`
- Cloud Build trigger connected to GitHub
- Deploy all three services to Cloud Run
- **Deliverable:** All services live on Cloud Run, auto-deploy working

### Week 12 — Polish and Launch
- Error handling across all endpoints
- Loading and empty states in UI
- Mobile responsiveness
- Sentry integration
- PostHog integration
- Cloud Monitoring alerts configured
- **Deliverable:** Live at production URLs, monitoring active, ready for users

---

*See 00-INDEX.md for the full file map*
