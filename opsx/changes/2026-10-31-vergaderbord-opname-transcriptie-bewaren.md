# Title

Vergaderbord: transcriptie bij de opname bewaren

## Context

Bij een update-opname uploadt de browser de audio naar `POST /api/boards/cards/{id}/recordings` en stuurt dezelfde audio daarna nogmaals naar `POST /api/boards/transcribe`. De tekst komt alleen in het update-invoerveld; `recordings.transcription_status` blijft altijd `pending` en `transcription_text` leeg. In productie gold dat op 2026-10-31 voor alle 40 opnames (65 minuten audio, 61 MB).

## Goals / Non-goals

### Goals

- Transcribeer de opgeslagen opname server-side en bewaar tekst en status (`done`/`failed`) bij de opname.
- Audio niet twee keer uploaden.
- Toon de transcriptie bij de opname in het kaartdetail, met handmatig opnieuw proberen bij een mislukking.
- Laat de worker opnames die `pending` blijven (bestaande opnames, onderbroken verzoeken) alsnog transcriberen.

### Non-goals

- Geen wijziging aan live dicteren bij een nieuwe kaart of aan de tekstreview.
- Geen opslag van foutdetails in de database (alleen een logregel) en geen datamigratie.

## Proposed approach

1. `BoardRecordingTranscriptionService.transcribe` roept OpenAI aan met het opgeslagen bestand en zet `done` + tekst of `failed`; de status blijft tijdens het werk ongewijzigd zodat een onderbroken verzoek `pending` achterlaat.
2. `POST /api/boards/recordings/{id}/transcribe` (schrijfrecht op de kaart) gebruikt de service; `done` wordt niet opnieuw getranscribeerd.
3. De worker-cyclus verwerkt per cyclus maximaal 5 `pending`-opnames die ouder zijn dan 5 minuten, alleen als OpenAI is geconfigureerd.
4. De frontend gebruikt na upload het nieuwe endpoint in plaats van `/boards/transcribe` en toont de transcriptie uitklapbaar onder de audio.

## Acceptance criteria

1. Na een update-opname staat de transcriptie bij de opname en is de kaart via de bordzoekfunctie te vinden.
2. Mislukte transcripties tonen "Transcriptie is mislukt" met een knop om opnieuw te proberen.
3. Bestaande `pending`-opnames worden door de worker getranscribeerd; recente opnames worden niet dubbel verwerkt.

## Risk + rollback plan

- Eenmalige OpenAI-kosten voor 65 minuten bestaande audio (orde van grootte enkele tientallen centen); deze audio is bij opname al naar OpenAI gestuurd.
- Opnames groter dan de OpenAI-limiet van 25 MB worden `failed`; uploads mogen tot 100 MB.
- Rollback: vorige release; de extra tekstkolomwaarden zijn onschadelijk.

## Verification evidence

Zie PR: backendtests voor endpoint (succes, idempotentie, toegang, zoeken), mislukking + retry en worker-selectie; frontendtests voor het nieuwe uploadpad, weergave en retry.
