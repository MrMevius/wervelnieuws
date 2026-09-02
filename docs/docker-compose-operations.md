# Docker Compose operations

This runbook separates schema releases from normal runtime lifecycle operations. The long-running services are `backend`, `frontend`, and `worker`, all with `restart: unless-stopped`. `migrate` runs `alembic upgrade head` once and has no restart policy or runtime dependency.

> **Important:** never use a broad `docker compose up` for normal runtime start or recovery. It selects all Compose services, including `migrate`. Runtime lifecycle commands must name the three runtime services and must not cause a schema migration.

Use [release-readiness.md](release-readiness.md) for the production release preflight and release-specific runtime checks.

## Preflight

From the repository root, with the production `.env` and required bind-mount paths in place:

```bash
docker compose config
docker compose config --images
```

Confirm that `backend`, `frontend`, and `worker` have `restart: unless-stopped`, that no runtime service depends on `migrate`, and that `migrate` retains `alembic upgrade head`.

## Controlled release and migration

1. Complete the [release-readiness checklist](release-readiness.md#release-readiness-checklist).
2. Create and verify a database **and** storage backup outside active storage.
3. Stop the SQLite writers before changing the schema:

   ```bash
   docker compose stop backend worker
   ```

4. Run the migration explicitly and wait for its one-shot exit status:

   ```bash
   docker compose run --rm --no-deps migrate
   ```

   Do not continue if this command fails. Do not use an Alembic downgrade or edit historical migrations in production.

5. Start only the runtime services:

   ```bash
   docker compose up -d --no-deps backend frontend worker
   ```

6. Capture and retain the no-automatic-migration evidence described below, then run the status and smoke checks. Confirm that no `migrate` container was created or run as part of the runtime start.

## Runtime lifecycle without migration

Start or recreate the complete runtime set without a migration:

```bash
docker compose up -d --no-deps backend frontend worker
```

Stop the runtime set:

```bash
docker compose stop backend frontend worker
```

Restart the runtime set:

```bash
docker compose restart backend frontend worker
```

For a targeted configuration change, name only the affected runtime services, for example:

```bash
docker compose up -d --force-recreate --no-deps backend worker
```

For a controlled lifecycle proof, capture the `migrate` state immediately before and immediately after the runtime command. A prior exited migration container does not by itself prove that the runtime command did not run a migration. Record the UTC timestamps and compare the container ID, start/finish timestamps and exit code; alternatively retain matching Docker event evidence for the command window:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
docker compose ps --all --format json
docker compose ps -aq migrate | xargs -r docker inspect --format '{{.Id}} started={{.State.StartedAt}} finished={{.State.FinishedAt}} exit={{.State.ExitCode}}'

# In a second terminal, before the runtime command, capture events for its full window:
docker events --filter type=container --filter event=create --filter event=start --filter event=die
```

After the runtime command, repeat the timestamp, `docker compose ps --all --format json`, and `docker inspect` commands. The proof passes only when no new `migrate` container ID exists and no existing `migrate` container has a changed start/finish timestamp; if Docker events were captured, the window must contain no `migrate` create/start/die event. Retain only sanitized output (no environment, mount paths, log content or secrets).

## Status, health, metrics and logs

Run these read-only commands at fixed intervals during a representative normal-use window. Record only aggregate values and redact host paths, secrets, user data, headers, tokens and connection strings.

```bash
docker compose ps
docker stats --no-stream $(docker compose ps -q backend frontend worker)
docker inspect --format '{{.Name}} status={{.State.Status}} started={{.State.StartedAt}} restarts={{.RestartCount}} log-driver={{.HostConfig.LogConfig.Type}} log-options={{json .HostConfig.LogConfig.Config}}' $(docker compose ps -q backend frontend worker)
```

For Docker log size and growth, an operator with host access must use the existing daemon-approved procedure against each container's log path. Record size at the start and end of the window and calculate the growth rate; do not publish paths or log contents.

The baseline decision rules are:

- add no Compose resource limit or reservation unless repeated measurements show resource contention, memory pressure, or a service-specific operational need;
- add no Compose logging option unless measurements show unmanaged log growth and the Docker/Compose version supports the proposed setting;
- if a setting is justified, document its measured trigger, value, expected degradation, compatibility and a one-setting rollback before applying it.

The current Compose file deliberately declares no CPU/memory limits, reservations or logging overrides: the available repository-local measurement is insufficient to choose safe values, and the running containers inherit the Docker daemon's existing `local` log driver configuration.

Smoke checks after a controlled runtime start:

```bash
curl --fail --silent --show-error http://localhost:8001/health
curl --fail --silent --show-error http://localhost:5173/
docker compose ps
```

Confirm `backend`, `frontend`, and `worker` remain running without unexpected exits or restarts. The worker has no HTTP endpoint; its running status and restart count are its available runtime indicators.

## Rollback

If a runtime smoke check fails, stop the affected runtime services, restore the previously verified Compose configuration and immutable release artifact, then start only the runtime set:

```bash
docker compose stop backend frontend worker
docker compose up -d --no-deps backend frontend worker
```

If the explicit migration failed or schema/data is implicated, keep backend and worker stopped and restore the verified database and matching storage backup with the previous release artifact. Do not downgrade or manually edit historical Alembic revisions.
