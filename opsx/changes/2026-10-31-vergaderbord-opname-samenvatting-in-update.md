# Title

Vergaderbord: opname samenvatten en samen met de opname in één update plaatsen

## Context

Na een update-opname wordt de opgeslagen audio getranscribeerd en vrij herschreven in het update-veld. De opname zelf verschijnt als los activiteititem naast de updates. Gewenst: transcriberen, samenvatten in relevante bullets met context van het kaartje en het bord, en opname plus samenvatting in dezelfde update.

## Goals / Non-goals

### Goals

- Samenvatting in maximaal 8 Nederlandse bullets met afspraken, besluiten en actiepunten.
- Context: titel, beschrijving en eerdere updates van het kaartje plus de andere actieve kaartjes op hetzelfde bord, begrensd in omvang.
- Feiten uitsluitend uit de transcriptie; context alleen voor namen, termen, verwijzingen en relevantie (AGENTS AI-regels).
- Opname en samenvatting in één update; volledige transcriptie uitklapbaar in die update.
- De gebruiker controleert en plaatst de update zelf.

### Non-goals

- Geen automatisch plaatsen zonder controle; geen context van andere borden.
- Geen wijziging aan live dicteren bij een nieuwe kaart.

## Proposed approach

1. Migratie `20261031_0034`: nullable `card_updates.recording_id` met index; revisies nemen de koppeling over.
2. `POST /api/boards/recordings/{id}/summary` transcribeert zo nodig en vat samen via `BoardRecordingTranscriptionService.summarize`; uitvoer wordt genormaliseerd naar `- `-bullets.
3. `POST /cards/{id}/updates` accepteert `recording_id` (zelfde kaart, nog niet gekoppeld aan een zichtbare update).
4. Kaartdetail toont gekoppelde opnames in de update en niet meer los; na verwijderen van de update verschijnt de opname weer los.
5. Frontend: na opname samenvatten, tekst in het update-veld, melding "wordt bij deze update geplaatst" met "Niet toevoegen"; bij mislukte samenvatting de volledige transcriptie.

## Acceptance criteria

1. Na opname staat een bulletsamenvatting in het update-veld; geplaatste update bevat de audiospeler en uitklapbare transcriptie.
2. De prompt bevat kaartje-, update- en bordcontext en de instructie geen feiten uit context toe te voegen.
3. Een opname van een ander kaartje of een al gekoppelde opname kan niet worden gekoppeld.
4. Bewerken behoudt de koppeling; verwijderen maakt de opname weer zichtbaar als los item.

## Verification evidence

Zie PR: backendtests voor prompt/context, normalisatie, koppelen, 409/422, bewerken/verwijderen, migratie-roundtrip; frontendtests voor samenvat-flow, fallback, loskoppelen en weergave in de update.
