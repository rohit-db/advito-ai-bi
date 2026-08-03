# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────
# Stage 1: build the Vite/React frontend → frontend/dist
# ──────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /build/frontend

# Install deps first (cached layer keyed on lockfiles only)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build the SPA
COPY frontend/ ./
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────
# Stage 2: runtime — FastAPI app served by uvicorn
# ──────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_PORT=8000

WORKDIR /app

# Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app.py ./
COPY server/ ./server/

# Built frontend from the frontend-build stage
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Run as a non-root user
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Shell-form CMD so ${APP_PORT:-8000} is expanded at runtime.
CMD ["sh", "-c", "exec python -m uvicorn app:app --host 0.0.0.0 --port ${APP_PORT:-8000}"]
