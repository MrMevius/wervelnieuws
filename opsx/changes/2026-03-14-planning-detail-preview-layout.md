## Title
Planning detail - leesbare media previews en logische pagina-indeling

## Context
De huidige pagina `Planningsregel detail` toont per kanaal vooral ruwe editorvelden, waardoor het moeilijk is om snel te beoordelen hoe content per medium eruitziet. In de praktijk verschijnt kanaalcontent soms ook als JSON-tekst in plaats van leesbare inhoud, wat review en goedkeuring vertraagt.

## Goals / Non-goals
### Goals
- De planning-detail pagina heeft een duidelijkere, logischere informatie-indeling.
- Kanaalcontent wordt als echte, leesbare preview getoond per medium (Website, Facebook, Nieuwsbrief).
- Inhoud die als JSON-string binnenkomt wordt robuust genormaliseerd naar leesbare velden voor preview.
- Kanaalstatus is in een oogopslag zichtbaar via compacte badges.
- Redacteur kan wisselen tussen een gefocuste preview en een overzicht met alle previews naast elkaar.
- Kanaalpreviews krijgen een subtiel eigen visuele typografie zodat Website/Facebook/Nieuwsbrief beter onderscheidbaar zijn.
- De pagina blijft bruikbaar op desktop en mobiel.
- Frontend tests en build blijven groen.

### Non-goals
- Geen backend-API wijzigingen of datamodelwijzigingen.
- Geen wijziging aan publicatieflow of goedkeuringsregels.
- Geen uitbreiding van rich text-functionaliteit buiten bestaande basis.

## Proposed approach
1. Herstructureer de detailpagina naar duidelijke secties: context, planningacties/voortgang, kanaalredactie, bronpassages, finale acties.
2. Voeg kanaalselectie toe zodat redacteurs per medium gefocust kunnen werken.
3. Toon naast bewerkvelden een kanaalspecifieke previewkaart met titel, artikel, samenvatting en illustratiepad.
4. Implementeer een kleine normalisatielaag die JSON-achtige content omzet naar bruikbare velden voordat deze in editor/preview komt.
5. Voeg statusbadges toe en implementeer preview-modus schakelaar (gefocust/alle previews).
6. Update CSS en frontend tests op de nieuwe structuur en labels.

## Implementation steps (ordered)
1. Maak helperfuncties voor veilige content-normalisatie/parsing van variantvelden.
2. Pas `PlanningRuleDetailPage` aan met actieve kanaalkeuze en split-view (bewerken + preview).
3. Voeg kanaalspecifieke previewcomponenten/markup toe binnen `App.tsx`.
4. Werk `styles.css` bij met nieuwe layout-klassen, preview cards en responsive gedrag.
5. Werk relevante tests in `App.test.tsx` bij op nieuwe labels/structuur.
7. Draai frontend verificatiecommando's en leg bewijs vast.

## Acceptance criteria
- De pagina toont een duidelijk gescheiden structuur met topsectie, kanaalsectie en bronsectie.
- Per medium wordt een leesbare preview getoond die overeenkomt met de huidige conceptinhoud.
- JSON-achtige content (bijv. tekst met `{ "title": ... }`) wordt niet als ruwe blob getoond maar leesbaar verwerkt.
- Kanaalspecifieke redactie (opslaan/akkoord/afwijzen) blijft functioneel.
- Kanaaltabs en preview tonen status met duidelijke badges (`In review`, `Akkoord`, `Afgekeurd`).
- Er is een bedienbare schakelaar voor previewmodus met `Gefocuste preview` en `Alle previews`.
- `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: nieuwe layout kan bestaande testselectoren breken.
  - Mitigatie: tests direct meewerken op nieuwe semantische labels en headings.
- Risico: agressieve parsing kan geldige tekst verkeerd interpreteren.
  - Mitigatie: parsing alleen toepassen bij duidelijke JSON-indicaties en veilige fallback naar originele tekst.
- Rollback:
  - Frontendcomponent en styles terugzetten naar vorige versie.
  - Testaanpassingen terugdraaien.

## Notes / links
- Gebruikersvraag: “previewberichten van verschillende media fatsoenlijk tonen en hele pagina logischer/beter ingedeeld en leesbaarder maken”.

## Current status
Completed

## What changed
- `frontend/src/app/App.tsx` herwerkt voor een logischere detailflow:
  - nieuwe `Kanaalredactie` sectie met kanaaltabs (`Website`, `Facebook`, `Nieuwsbrief`) en actieve selectie;
  - split-view werkruimte: links redactie (titel/artikel/samenvatting + acties), rechts live preview;
  - bestaande kanaalacties (`Opslaan`, `Akkoord`, `Afwijzen`) blijven actief op het geselecteerde medium.
- Kanaalpreview toegevoegd in dezelfde component met mediumspecifieke contextlabels en duidelijke presentatie van artikel/samenvatting.
- Robuuste content-normalisatie toegevoegd in `frontend/src/app/App.tsx`:
  - JSON-achtige payloads in titel/artikel/samenvatting (ook in ```json codefences) worden automatisch geparsed;
  - parsed velden (`title`, `article_body`, `summary`) vullen de editor/preview;
  - veilige fallback naar originele tekst wanneer parsing niet mogelijk is.
- Preview-rendering verbeterd met helperlogica voor HTML of platte tekst, inclusief escaping en nette weergave van lege inhoud.
- `frontend/src/styles.css` uitgebreid voor leesbaarheid en structuur:
  - nieuwe layoutklassen voor kanaaltabs, split-view, previewpanelen en responsive gedrag;
  - visuele scheiding per mediumpreview met rustige achtergrondvarianten.
- Follow-up UX-uitbreiding doorgevoerd in `frontend/src/app/App.tsx` en `frontend/src/styles.css`:
  - previewmodus-schakelaar toegevoegd met `Gefocuste preview` en `Alle previews`;
  - bij `Alle previews` worden Website/Facebook/Nieuwsbrief tegelijk als kaarten naast elkaar getoond;
  - compacte statusbadges toegevoegd in tabs, editorstatus en previewstatus (`In review`, `Akkoord`, `Afgekeurd`).
- Extra visual polish toegevoegd in `frontend/src/styles.css`:
  - kanaalspecifieke typografie voor previewkaarten (Website: rustiger artikeltypografie, Facebook: compacter social-format, Nieuwsbrief: ruimere e-mailstijl);
  - subtiele, korte preview-load animatie voor soepelere visuele overgang bij wisselen van kanaal/modus.
- Mobiele fine-tuning toegevoegd in `frontend/src/styles.css` onder `@media (max-width: 920px)`:
  - compactere spacing voor kanaalworkspace, previews en kaarten;
  - beter leesbare mobiele tekstgrootte/regelhoogte in preview-inhoud;
  - previewmodus-knoppen op mobiel beter bedienbaar (volle breedte, duidelijke touch targets);
  - statusregel en Facebook/Nieuwsbrief previewkaart aangepast voor small-screen leesbaarheid.
- `frontend/src/app/App.test.tsx` bijgewerkt:
  - assertions aangepast op de nieuwe kanaal-tabstructuur en preview-heading;
  - nieuwe regressietest toegevoegd voor leesbare weergave wanneer kanaalcontent als JSON binnenkomt;
  - extra test toegevoegd die de previewmodus omschakelt naar `Alle previews` en alle kanaalpreviews valideert.
- Website changelog geupdate conform repository-regel in `backend/app/api/meta.py` met iteratie `14` voor deze functionele verbetering.

## How to verify
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `cd frontend && npm test -- --run` -> geslaagd (`29 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript build + Vite productiebuild afgerond).
- `cd frontend && npm test -- --run` (na UX follow-up) -> geslaagd (`30 passed`).
- `cd frontend && npm run build` (na UX follow-up) -> geslaagd.
- `cd frontend && npm test -- --run` (na visual polish) -> geslaagd (`30 passed`).
- `cd frontend && npm run build` (na visual polish) -> geslaagd.
- `cd frontend && npm test -- --run` (na mobiele fine-tune) -> geslaagd (`30 passed`).
- `cd frontend && npm run build` (na mobiele fine-tune) -> geslaagd.
