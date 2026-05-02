import logging
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, rfq, suppliers, responses, analysis, internal_tasks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)

app = FastAPI(title="QuoteFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(rfq.router, prefix="/api/rfq", tags=["rfq"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["suppliers"])
app.include_router(responses.router, prefix="/api/response", tags=["responses"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(internal_tasks.router, tags=["internal"])


@app.get("/health")
def health():
    return {"status": "ok"}
