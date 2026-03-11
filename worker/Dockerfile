FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend /app/backend
COPY worker /app/worker

RUN pip install --no-cache-dir -e /app/backend

WORKDIR /app/backend
CMD ["python", "/app/worker/app/runner.py"]
