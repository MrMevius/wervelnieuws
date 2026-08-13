FROM python:3.11-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY backend /app/backend
COPY worker /app/worker

RUN pip install --no-cache-dir --no-compile -e /app/backend

WORKDIR /app/backend
CMD ["python", "/app/worker/app/runner.py"]
