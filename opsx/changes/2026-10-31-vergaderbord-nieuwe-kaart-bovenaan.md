# Title

Vergaderbord: nieuwe kaart bovenaan de kolom

## Context

`BoardRepository.create_card` plaatste een nieuwe kaart onderaan de kolom (`max(position) + 1`). Bovendien gaf `int(max_position or -1) + 1` bij een maximum van `0` opnieuw positie `0`, waardoor de tweede kaart in een kolom dezelfde positie kreeg als de eerste.

## Goals / Non-goals

### Goals

- Een via het bord aangemaakte kaart krijgt positie `0` in zijn kolom; bestaande actieve kaarten in die kolom schuiven één plek op met behoud van onderlinge volgorde.

### Non-goals

- Trello-import blijft kaarten in bronvolgorde achteraan toevoegen.
- Geen wijziging aan verplaatsen, archiveren of herstellen; geen datamigratie.

## Proposed approach

`create_card(..., at_top=True)` hernummert de actieve kaarten in de doelkolom naar `1..n` en plaatst de nieuwe kaart op `0`. Het append-pad gebruikt een correcte `None`-check.

## Acceptance criteria

1. Nieuwe kaart staat bovenaan de gekozen kolom; andere kolommen veranderen niet.
2. Bestaande volgorde blijft onder de nieuwe kaart behouden.
3. Trello-import behoudt bronvolgorde.

## Verification evidence

Zie PR: backend-regressietest voor volgorde over meerdere kolommen, volledige backend- en frontendsuite.
