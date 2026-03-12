# Docker bind mount voor serveropslag en configpad

## Context
De gebruiker wil dat alle applicatiebestanden persistent op de server worden opgeslagen via een host mount op:

- `/mnt/wervelwind/database/`

Daarnaast moet de configuratie ook op die locatie staan onder:

- `/mnt/wervelwind/database/config/`

en in containers beschikbaar zijn via `/config`.

## Goals / Non-goals
### Goals
- Vervang de Docker named volume door een bind mount naar `/mnt/wervelwind/database`.
- Maak `/config` in de containers beschikbaar via bind mount naar `/mnt/wervelwind/database/config`.
- Laat backend/worker/migrate config lezen vanuit `/mnt/wervelwind/database/config/.env`.
- Werk operationele instructies bij zodat deploy op server direct klopt.

### Non-goals
- Geen aanpassing van applicatielogica voor opslagpaden (`/data` blijft intern pad).
- Geen wijziging van domeinmodel of API-functionaliteit.

## Proposed approach
1. Pas `docker-compose.yml` aan met bind mounts voor `/data` en `/config`.
2. Zet `env_file` voor backend/worker/migrate naar hostpad in `.../config/.env`.
3. Update `README.md` quickstart met serverpad-instructies.

## Implementation steps (ordered)
1. Nieuwe active spec aanmaken voor deze infra-wijziging.
2. `docker-compose.yml` aanpassen:
   - verwijder named volume usage voor app data;
   - voeg bind mounts toe voor `/data` en `/config`.
3. `env_file` aanpassen naar `/mnt/wervelwind/database/config/.env` voor relevante services.
4. `README.md` updaten met mappen aanmaken + `.env` locatie onder `/mnt/wervelwind/database/config`.
5. Compose validatie draaien.

## Acceptance criteria
- Data wordt persistent opgeslagen via hostpad `/mnt/wervelwind/database`.
- Containers hebben configmount op `/config`.
- Backend/worker/migrate gebruiken `.env` uit `/mnt/wervelwind/database/config/.env`.
- Documentatie beschrijft de nieuwe setup.

## Testing plan
- Valideer compose:
  - `docker compose config`

## Risk + rollback plan
- Risico: pad bestaat niet op server, waardoor containerstart faalt.
  - Mitigatie: expliciete README-stap om paden vooraf aan te maken.
- Rollback: revert `docker-compose.yml` naar named volume setup.

## Notes / links
- User request: server bind mount voor data + configlocatie onder `/config`.

## Current status
Completed

## What changed
- `docker-compose.yml` aangepast:
  - backend/worker/migrate ondersteunen nu robuuste env loading:
    - optioneel `.env` in de repo (fallback)
    - optioneel `/mnt/wervelwind/database/config/.env` (server-config)
    - hiermee faalt `docker compose` niet meer hard als server `.env` ontbreekt.
  - backend/worker/migrate hebben nu bind mounts:
    - `${WERVEL_STORAGE_DIR:-/mnt/wervelwind/database}:/data`
    - `${WERVEL_CONFIG_DIR:-/mnt/wervelwind/database/config}:/config`
  - named volume `app_data` verwijderd.
- `README.md` aangepast:
  - quickstart legt nu uit dat je `/mnt/wervelwind/database/config/.env` gebruikt;
  - expliciete stap toegevoegd om `/mnt/wervelwind/database/config` aan te maken;
  - checklist/omgevingstekst geactualiseerd naar server configpad.
  - extra server path permissions checklist toegevoegd met voorbeeld voor
    `mkdir`, `chown`, en `chmod` op `/mnt/wervelwind/database`.

## How to verify
- Maak servermap en env-bestand aan:
  - `sudo mkdir -p /mnt/wervelwind/database/config`
  - `cp .env.example /mnt/wervelwind/database/config/.env`
- Controleer host permissies/eigenaarschap:
  - `sudo chown -R $USER:$USER /mnt/wervelwind/database`
  - `sudo chmod -R u+rwX,g+rX /mnt/wervelwind/database`
- Valideer compose:
  - `docker compose config`
- Start stack:
  - `docker compose up -d --build`
- Controleer mounts in backend-container:
  - `docker compose exec backend sh -lc "ls /data && ls /config"`

## Verification evidence
- Specbestand aangemaakt: `opsx/changes/2026-03-12-docker-bind-mount-server-storage.md`.
- `docker compose config`
  - Resultaat: succesvol (compose validatie slaagt zonder harde fout op ontbrekende server `.env`).
- README aangevuld met server path permissions checklist in Quick start-sectie.
