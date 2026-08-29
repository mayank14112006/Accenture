# Stage 1 — dashboard build
FROM node:22-alpine AS dashboard
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY dashboard/ ./
RUN npm run build

# Stage 2 — gateway (lite profile: no model weights, starts in seconds,
# runs in <1 GB RAM; the full profile is an opt-in documented in the README)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY controlplane/ controlplane/
COPY policies/ policies/
COPY evals/ evals/
COPY demo/ demo/
COPY scripts/ scripts/
COPY --from=dashboard /build/dist dashboard/dist
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=25s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/ready')"
CMD ["python", "-m", "uvicorn", "controlplane.main:app", "--host", "0.0.0.0", "--port", "8080"]
