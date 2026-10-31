# Title

Vergaderbord: avatars zichtbaar voor niet-admins

## Context

`VergaderbordenPage` laadt avatars van bordleden en betrokkenen via `GET /api/admin/users/{user_id}/avatar`, dat `require_admin` vereist. Niet-admin gebruikers krijgen `403` en zien geen profielfoto's.

## Goals / Non-goals

### Goals

- Iedere ingelogde gebruiker kan avatars van bordleden laden.
- Admin-endpoint blijft admin-only.

### Non-goals

- Geen wijziging aan avatar-upload of gebruikersbeheer.
- Geen fijnmazige autorisatie per bord: namen van bordleden zijn al zichtbaar voor ingelogde gebruikers; een profielfoto voegt binnen dit kleine interne team geen materieel gevoelige informatie toe.

## Proposed approach

1. Nieuw `GET /api/boards/users/{user_id}/avatar` met `get_current_user`.
2. Gedeelde `avatar_service.avatar_file_response` voor admin-, eigen- en bord-avatar; `/auth/me/avatar` krijgt daardoor ook het juiste mediatype voor JPEG/GIF/WebP.
3. Frontend `getBoardUserAvatarUrl` vervangt `getAdminUserAvatarUrl` op de vergaderborden.

## Acceptance criteria

1. Een niet-admin krijgt `200` voor de avatar van een andere gebruiker via het bord-endpoint, en nog steeds `403` via het admin-endpoint.
2. Onbekende gebruiker of ontbrekende avatar geeft `404`; zonder login `401`.
3. Vergaderborden gebruiken het bord-endpoint.

## Verification evidence

Zie PR: backend-regressietest voor 200/403/404/401, volledige backend- en frontendsuite en build.
