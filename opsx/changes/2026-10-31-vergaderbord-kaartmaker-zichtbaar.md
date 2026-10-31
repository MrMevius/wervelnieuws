# Title

Vergaderbord: zichtbaar wie een kaart heeft aangemaakt

## Context

Op een vergaderbord is niet te zien wie een kaart heeft aangemaakt. `board_cards` heeft geen makerveld. Wel logt `POST /api/boards/projects/{project_id}/cards` sinds de start van de vergaderborden een auditregel `board.card.created` met `actor_user_id` en `card_id` in `details_json`. Trello-imports loggen geen regel per kaart.

## Goals / Non-goals

### Goals

- Leg bij het aanmaken van een kaart vast wie de maker is.
- Vul de maker voor bestaande kaarten aan vanuit de audittrail waar dat betrouwbaar kan.
- Toon in het kaartdetail wie de kaart wanneer heeft aangemaakt.
- Maak Trello-imports en kaarten zonder te achterhalen maker eerlijk herkenbaar.

### Non-goals

- Geen maker op de kaarttegel van het bord (kan later als vervolg).
- Geen poging de oorspronkelijke Trello-maker te reconstrueren.
- Geen wijziging aan rechten, audit of andere kaartacties.

## Proposed approach

1. Voeg nullable `board_cards.created_by_user_id` (FK `users.id`, index) toe.
2. Migratie `20261031_0033` backfillt uit de vroegste `board.card.created`-auditregel per kaart, alleen voor bestaande gebruikers en niet voor Trello-kaarten.
3. `BoardCardResponse` krijgt `created_at`, `created_by_*` en `is_trello_import`.
4. Het kaartdetail toont "Aangemaakt door … op …", "Geïmporteerd uit Trello op …" of "Aangemaakt op … · maker onbekend".

## Acceptance criteria

1. Een nieuw aangemaakte kaart toont de maker in API en kaartdetail, ook voor andere bordleden.
2. Bestaande kaarten met een `board.card.created`-auditregel van een bestaande gebruiker krijgen die gebruiker als maker.
3. Trello-kaarten, kaarten zonder auditregel en kaarten van verwijderde gebruikers houden geen maker.
4. Upgrade en downgrade van de migratie verliezen geen kaarten.

## Risk + rollback plan

- Additieve, nullable kolom; bestaande data blijft ongewijzigd behalve het nieuwe veld.
- Stop database-writers en verifieer database-/storageback-ups vóór de upgrade, zoals bij eerdere releases.
- Downgrade naar `20260910_0032` verwijdert alleen de kolom; een nieuwe upgrade leidt de makers opnieuw af uit de audittrail. Makers van kaarten aangemaakt na de upgrade blijven via die audittrail herleidbaar.

## What changed

- Model, repository, API-respons en Alembic-migratie `20261031_0033` met audit-backfill; `EXPECTED_HEAD` in de release-preflight bijgewerkt.
- Frontend `BoardCard`-type en maker-regel onder de titel in het kaartdetail.
- Changelog-iteratie 124 op de About-pagina.

## How to verify

1. Maak een kaart aan en open het kaartdetail: onder de titel staat "Aangemaakt door <naam> op <datum tijd>".
2. Open een Trello-geïmporteerde kaart: "Geïmporteerd uit Trello op …".
3. Na upgrade van een bestaande database tonen eerder via de app aangemaakte kaarten hun maker.

## Verification evidence

- Backend: 381 passed, 1 skipped (`pytest`), inclusief nieuwe migratie-roundtrip-test en API-asserties voor maker en Trello-import.
- Frontend: 230 tests passed, TypeScript zonder fouten, Vite-productiebuild geslaagd (bestaande chunkgrootte-waarschuwing blijft).
- Release-schema-preflight: geslaagd op head `20261031_0033`.
- Geen productie- of dev-database-upgrade uitgevoerd.
