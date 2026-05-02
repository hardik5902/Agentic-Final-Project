FROM python:3.12-slim

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

WORKDIR /app/backend

EXPOSE 8080

# Run migrations then start with:
#  - 4 uvicorn workers (2 vCPU → 4 workers is the 2x rule)
#  - explicit 290s keepalive (just under Cloud Run's 300s timeout)
#  - graceful shutdown so in-flight AI calls complete
CMD ["sh", "-c", "\
  uv run alembic upgrade head && \
  uv run uvicorn main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8080} \
    --workers 4 \
    --timeout-keep-alive 290 \
    --timeout-graceful-shutdown 30 \
"]
