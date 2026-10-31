# Title

Vergaderbord: klikbare links in kaartbeschrijvingen en updates

## Context

`RichTextRenderer` in `VergaderbordenPage.tsx` ondersteunt alleen vet, cursief, onderstrepen en lijsten. URL's en Markdown-links (ook uit Trello-imports, `[url](url "smartCard-inline")`) worden als platte tekst getoond. De beschrijving in het kaartdetail is bovendien een klik-om-te-bewerken-vlak.

## Goals / Non-goals

### Goals

- Render Markdown-links `[tekst](http(s)://…)`, losse `http(s)://`-URL's en `www.`-adressen als links in beschrijvingen en updates.
- Open links in een nieuw tabblad met `rel="noopener noreferrer"`.
- Een klik of Enter op een link opent niet de bewerkmodus.

### Non-goals

- Geen linkknop in de editor en geen andere protocollen dan http(s).
- Geen backend- of datawijziging.

## Proposed approach

Splits inline tekst eerst op links, pas daarna de bestaande opmaak toe op de tussenliggende tekst en het linklabel. Afsluitende leestekens worden niet in een losse URL meegenomen.

## Acceptance criteria

1. Losse URL's, `www.`-adressen en Markdown-links zijn klikbare links in kaartdetail, updates en prullenbak.
2. Alleen `http`/`https` wordt als link gerenderd.
3. Klikken op een link in de beschrijving opent de bewerkmodus niet.
4. Bestaande opmaak blijft werken.

## What changed

- `BoardLink` en linkherkenning in `applyInlineTokens`; bestaande opmaak verplaatst naar `applyFormattingTokens`.
- Linkstijl voor beschrijving en updates.
- Changelog-iteratie 125.

## How to verify

Open een kaart met een URL in beschrijving of update, klik de link: er opent een nieuw tabblad en de beschrijving blijft in leesmodus.

## Verification evidence

Zie PR; frontendtest controleert href/target/rel, Trello-Markdown, `www.`, afsluitende punt en dat de bewerkmodus niet opent (faalt aantoonbaar zonder `stopPropagation`).
