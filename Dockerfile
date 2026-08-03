# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────
# Stage 1: build the Vite/React frontend → frontend/dist
# ──────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /build/frontend

# Constrain npm/node for low-RAM builders (Render free tier = 512 MB). Without
# this, `npm ci` on the ~224 MB dep tree OOM-crashes ("Exit handler never
# called!"), leaving node_modules incomplete so `tsc`/`vite` go missing.
ENV NODE_OPTIONS=--max-old-space-size=448 \
    npm_config_maxsockets=3 \
    npm_config_fund=false \
    npm_config_audit=false

# Install deps first (cached layer keyed on lockfiles only). --include=dev
# guarantees the build tooling (typescript/vite are devDependencies) installs
# regardless of any NODE_ENV=production the platform may inject.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Build the SPA. VITE_* are baked into the bundle at build time (Vite substitutes
# import.meta.env.* during `npm run build`), so the target workspace must be
# supplied as build args — frontend/.env is .dockerignore'd and never in the
# build context. NON-SECRET only (these end up in the client JS regardless).
ARG VITE_WORKSPACE_URL
ARG VITE_WORKSPACE_ORG
ENV VITE_WORKSPACE_URL=$VITE_WORKSPACE_URL \
    VITE_WORKSPACE_ORG=$VITE_WORKSPACE_ORG

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
