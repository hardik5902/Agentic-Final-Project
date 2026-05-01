# QuoteFlow — 02: Database Design

> Load this file when: working on database models, migrations, queries, or any data layer concern

---

## Tables Overview

| Table | Purpose |
|---|---|
| organizations | Buyer companies using QuoteFlow |
| users | Individual buyer team members |
| rfq_events | Each sourcing event created |
| rfq_conversations | Chat history for RFQ creation |
| suppliers | Buyer's supplier contact database |
| invitations | One row per supplier per RFQ event |
| responses | Supplier submitted response data |
| supplier_questions | Q&A between supplier and buyer |
| vendor_directory | Curated vendor suggestions database |

---

## Key Design Decisions

**JSONB columns for flexible data** — Requirements, response fields, and scoring breakdowns vary by product category. Storing these as JSONB avoids schema migrations every time a new category is added. The category template defines the structure; the database stores the data flexibly.

**Separate raw and normalized response data** — Each response row stores both `raw_data` (exactly what the supplier submitted) and `normalized_data` (after currency conversion, unit standardization, etc.). This allows re-running normalization without losing original submissions.

**Token-based supplier access** — The invitations table stores a unique token per invitation. Suppliers access the portal via this token in a URL — no account creation required. The token is a 64-character random string.

**Organization isolation** — Every query for buyer data filters by `org_id`. One organization can never see another's RFQs, suppliers, or responses. This is enforced at the service layer on every operation — not just in the router.

**Supplier performance tracking** — The suppliers table maintains running statistics: total invitations sent, total responses received, response rate, average response time. These update automatically each time an invitation is sent or a response is received.

**Cloud SQL Auth Proxy** — Cloud Run connects to Cloud SQL via the Cloud SQL Auth Proxy sidecar container. The `DATABASE_URL` points to localhost — the proxy handles the secure tunnel. No public IP needed for the database.

---

## Table Relationships

```
organizations
    ↓ has many
users

organizations
    ↓ has many
rfq_events
    ↓ has one
rfq_conversations

rfq_events
    ↓ has many
invitations
    ↓ belongs to
suppliers (one supplier per invitation)

invitations
    ↓ has one
responses

rfq_events
    ↓ has many
supplier_questions
```

---

## Table Definitions

### organizations

```
id                    UUID PRIMARY KEY
name                  VARCHAR(255) NOT NULL
industry              VARCHAR(100)
website               VARCHAR(255)
country               VARCHAR(100) DEFAULT 'US'
subscription_tier     VARCHAR(50) DEFAULT 'free'
monthly_rfq_count     INT DEFAULT 0
monthly_rfq_reset_date DATE
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
```

### users

```
id                    UUID PRIMARY KEY
org_id                UUID REFERENCES organizations(id) ON DELETE CASCADE
email                 VARCHAR(255) UNIQUE NOT NULL
password_hash         VARCHAR(255) NOT NULL
name                  VARCHAR(255)
role                  VARCHAR(50) DEFAULT 'buyer'
                      -- roles: owner, admin, buyer, viewer
is_active             BOOLEAN DEFAULT TRUE
last_login            TIMESTAMP
created_at            TIMESTAMP DEFAULT NOW()
```

### rfq_events

```
id                    UUID PRIMARY KEY
org_id                UUID REFERENCES organizations(id) ON DELETE CASCADE
created_by            UUID REFERENCES users(id)
title                 VARCHAR(500)
category              VARCHAR(100)
subcategory           VARCHAR(100)
status                VARCHAR(50) DEFAULT 'draft'
                      -- draft | active | closed | awarded | cancelled
deadline              TIMESTAMP
requirements          JSONB DEFAULT '{}'
                      -- structured fields collected from conversation
criteria              JSONB DEFAULT '[]'
                      -- [{name, weight, type: calculated|buyer_rated}]
rfq_document          TEXT
                      -- generated RFQ text content
rfq_document_pdf_url  VARCHAR
                      -- GCS object path for PDF version
memo_text             TEXT
                      -- generated decision memo
memo_pdf_url          VARCHAR
                      -- GCS object path for memo PDF
awarded_supplier_id   UUID
                      -- references suppliers table
internal_notes        TEXT
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
```

### rfq_conversations

```
id                    UUID PRIMARY KEY
rfq_id                UUID REFERENCES rfq_events(id) ON DELETE CASCADE
messages              JSONB DEFAULT '[]'
                      -- [{role: user|assistant, content: string, timestamp}]
template_used         VARCHAR(100)
fields_collected      JSONB DEFAULT '{}'
                      -- extracted structured fields
fields_remaining      JSONB DEFAULT '[]'
                      -- list of field names still needed
is_complete           BOOLEAN DEFAULT FALSE
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
```

### suppliers

```
id                    UUID PRIMARY KEY
org_id                UUID REFERENCES organizations(id) ON DELETE CASCADE
name                  VARCHAR(255) NOT NULL
email                 VARCHAR(255) NOT NULL
website               VARCHAR(255)
country               VARCHAR(100)
categories            TEXT[] DEFAULT '{}'
tags                  TEXT[] DEFAULT '{}'
notes                 TEXT
-- performance stats (auto-calculated)
total_invitations     INT DEFAULT 0
total_responses       INT DEFAULT 0
response_rate         FLOAT DEFAULT 0
avg_response_days     FLOAT
last_invited_at       TIMESTAMP
last_responded_at     TIMESTAMP
is_active             BOOLEAN DEFAULT TRUE
created_at            TIMESTAMP DEFAULT NOW()
UNIQUE(org_id, email)
```

### invitations

```
id                    UUID PRIMARY KEY
rfq_id                UUID REFERENCES rfq_events(id) ON DELETE CASCADE
supplier_id           UUID REFERENCES suppliers(id)
token                 VARCHAR(64) UNIQUE NOT NULL
                      -- 64-char random string used in supplier portal URL
status                VARCHAR(50) DEFAULT 'invited'
                      -- invited | viewed | responded | declined | bounced
email_sent_at         TIMESTAMP
reminder_1_sent_at    TIMESTAMP
reminder_2_sent_at    TIMESTAMP
viewed_at             TIMESTAMP
responded_at          TIMESTAMP
declined_at           TIMESTAMP
decline_reason        TEXT
created_at            TIMESTAMP DEFAULT NOW()
```

### responses

```
id                    UUID PRIMARY KEY
invitation_id         UUID REFERENCES invitations(id)
rfq_id                UUID REFERENCES rfq_events(id)
supplier_id           UUID REFERENCES suppliers(id)
raw_data              JSONB NOT NULL DEFAULT '{}'
                      -- exactly what supplier submitted
normalized_data       JSONB DEFAULT '{}'
                      -- after currency, units, landed cost calculation
score                 FLOAT
score_breakdown       JSONB DEFAULT '{}'
                      -- {criterion_name: {raw, weighted, notes}}
flags                 JSONB DEFAULT '[]'
                      -- [{type, field, message, eliminates: bool}]
eliminated            BOOLEAN DEFAULT FALSE
elimination_reason    TEXT
buyer_ratings         JSONB DEFAULT '{}'
                      -- {criterion_name: 1-5 rating from buyer}
buyer_notes           TEXT
attachment_urls       JSONB DEFAULT '[]'
                      -- GCS object paths for uploaded files
submitted_at          TIMESTAMP DEFAULT NOW()
```

### supplier_questions

```
id                    UUID PRIMARY KEY
rfq_id                UUID REFERENCES rfq_events(id)
invitation_id         UUID REFERENCES invitations(id)
supplier_id           UUID REFERENCES suppliers(id)
question              TEXT NOT NULL
answer                TEXT
answered_by           UUID REFERENCES users(id)
is_shared_with_all    BOOLEAN DEFAULT TRUE
asked_at              TIMESTAMP DEFAULT NOW()
answered_at           TIMESTAMP
```

### vendor_directory

```
id                    UUID PRIMARY KEY
name                  VARCHAR(255) NOT NULL
email                 VARCHAR(255)
website               VARCHAR(255)
country               VARCHAR(100)
city                  VARCHAR(100)
categories            TEXT[] DEFAULT '{}'
subcategories         TEXT[] DEFAULT '{}'
description           TEXT
employee_range        VARCHAR(50)
                      -- "1-10", "11-50", "51-200", "201-500", "500+"
founded_year          INT
clutch_rating         FLOAT
clutch_reviews_count  INT
g2_rating             FLOAT
g2_reviews_count      INT
verified              BOOLEAN DEFAULT FALSE
source                VARCHAR(100)
                      -- clutch | g2 | manual | customer_added
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
```

---

## Required Indexes

```sql
CREATE INDEX idx_rfq_events_org_id ON rfq_events(org_id);
CREATE INDEX idx_rfq_events_status ON rfq_events(status);
CREATE INDEX idx_rfq_events_created_at ON rfq_events(created_at DESC);
CREATE INDEX idx_invitations_rfq_id ON invitations(rfq_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_responses_rfq_id ON responses(rfq_id);
CREATE INDEX idx_responses_supplier_id ON responses(supplier_id);
CREATE INDEX idx_suppliers_org_id ON suppliers(org_id);
CREATE INDEX idx_suppliers_categories ON suppliers USING GIN(categories);
CREATE INDEX idx_vendor_directory_categories
    ON vendor_directory USING GIN(categories);
CREATE INDEX idx_rfq_conversations_rfq_id ON rfq_conversations(rfq_id);
```

---

## Migration Strategy

Use Alembic for migrations. One migration file per schema change. Never edit existing migration files — always create a new one.

Migration naming: `{timestamp}_{description}.py`
Example: `20260428_001_create_organizations.py`

Run migrations on deployment via a Cloud Run Job that executes before the main service starts. The job runs `alembic upgrade head` and exits. Cloud Build triggers this job as a step after pushing the new Docker image.

---

## JSONB Field Formats

### rfq_events.requirements

```json
{
  "service_type": "video production",
  "budget_min": 12000,
  "budget_max": 18000,
  "timeline_weeks": 4,
  "revision_rounds_min": 2,
  "location_requirement": "remote",
  "team_size_preference": "small team"
}
```

### rfq_events.criteria

```json
[
  {"name": "proposed_approach", "label": "Approach Quality", "weight": 0.30, "type": "buyer_rated"},
  {"name": "price", "label": "Total Price", "weight": 0.25, "type": "calculated"},
  {"name": "portfolio", "label": "Portfolio Relevance", "weight": 0.25, "type": "buyer_rated"},
  {"name": "timeline", "label": "Delivery Timeline", "weight": 0.10, "type": "calculated"},
  {"name": "team_experience", "label": "Team Experience", "weight": 0.10, "type": "buyer_rated"}
]
```

### responses.flags

```json
[
  {
    "type": "hard_elimination",
    "field": "price",
    "message": "Total price $22,000 exceeds maximum budget $18,000",
    "eliminates": true
  },
  {
    "type": "warning",
    "field": "portfolio",
    "message": "Only 1 portfolio example provided, 2 requested",
    "eliminates": false
  }
]
```

### responses.normalized_data

```json
{
  "total_price_usd": 14500,
  "freight_per_unit_usd": 0,
  "landed_cost_per_unit_usd": 14500,
  "landed_cost_total_usd": 14500,
  "timeline_weeks": 4.0,
  "timeline_days": 28,
  "revision_rounds_included": 2,
  "effective_revision_cost": 0,
  "effective_total_cost": 14500
}
```

---

*See 00-INDEX.md for the full file map*
