FROM python:3.11-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY backend /app/backend

FROM base AS ffmpeg-base
ARG APP_UID=1000
ARG APP_GID=1000
RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${APP_GID}" app \
    && useradd --uid "${APP_UID}" --gid "${APP_GID}" --create-home --shell /usr/sbin/nologin app \
    && install -d -o app -g app -m 0700 /tmp/wervelnieuws-topic-audio

FROM ffmpeg-base AS runtime
RUN pip install --no-cache-dir --no-compile -e /app/backend

WORKDIR /app/backend
USER app:app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
