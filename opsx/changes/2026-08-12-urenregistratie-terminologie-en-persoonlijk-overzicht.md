# Title
Urenregistratie: terminologie en projecttotalen voor alle personen

## Context
De bestaande urenpagina gebruikt op meerdere zichtbare plaatsen nog de term **Urenverantwoording**. Bovenaan staat een eyebrow en verklarende tekst, terwijl de primaire pagina-inhoud nu start met **Overzicht en registreren**.

De oorspronkelijke goedgekeurde scope vroeg een persoonlijk overzicht van uren van de ingelogde gebruiker per project. De pre-implementation-inspectie heeft dit geblokkeerd: de bestaande groepslijst is gepagineerd (25, 50 of 100 items) en de frontend ontvangt alleen de geladen pagina. Een correct totaal over alle overeenkomende registraties kan daardoor niet client-side worden afgeleid zonder een nieuwe request of contractwijziging.

De gebruiker heeft de scope-amendment expliciet goedgekeurd: vervang het persoonlijke overzicht door **totaal person-hours per project, over alle personen**, en voeg daarvoor een backward-compatible `project_totals`-veld toe aan de bestaande gepagineerde groepenlijstrespons. De backend berekent dit veld op de volledige, gefilterde, actieve en gededupliceerde groepsset vóór pagination. Deze wijziging heft de eerdere contractblokkade op.

## Goals / Non-goals

### Goals
- Hernoem alle door deze urenfunctie geraakte, gebruikerszichtbare labels van **Urenverantwoording** naar **Urenregistratie**, inclusief navigatielink, paginatitel en relevante documentatie- en testverwachtingen.
- Toon bovenaan uitsluitend de heading **Urenregistratie**; verwijder de eyebrow en huidige verklarende tekst.
- Toon een compact overzicht van totaal person-hours per project, voor alle deelnemers, in het bovenste rechterdeel van de urenpagina.
- Lever `project_totals` backward-compatible mee in de bestaande gepagineerde `GET /api/urenverantwoording/groepen`-respons.
- Bereken `project_totals` server-side over de volledige gefilterde, actieve en gededupliceerde set, onafhankelijk van de opgevraagde pagina en page size.
- Behoud responsiviteit, toegankelijke namen, toetsenbordbediening en bestaande registratie- en filterflows.

### Non-goals
- Geen nieuwe API-route, queryparameter of extra frontendrequest voor de projecttotalen.
- Geen wijziging van bestaande responsevelden, paginationsemantiek, sortering, opgeslagen uren, database of migraties; uitsluitend een optioneel/additief responseveld is toegestaan.
- Geen wijziging van groepsregistraties, deelnemers, registratie-, bewerk-, verwijder-, herstel-, historie-, audit-, CSV- of Admin-flows.
- Geen wijziging van autorisatie, ownership of de definitie van welke uren een gebruiker mag inzien.
- Geen herontwerp van de volledige urenpagina, applicatieshell of Admin-navigatie buiten de noodzakelijke zichtbare terminologiewijziging en het vervangende overzicht.
- Geen wijziging aan termen in historische auditdata, API-paden, interne domeinnamen, bestandsnamen of code-identifiers, tenzij technisch noodzakelijk voor een geraakte user-facing tekst of het nieuwe responseveld.

## Proposed approach
1. Inventariseer zichtbare occurrences van `Urenverantwoording` in de urenroute, navigatie, About/changelog en urenhandleiding. Vervang uitsluitend user-facing teksten; technische route- en API-namen blijven intact.
2. Vereenvoudig de paginakop tot één semantische `h1` met **Urenregistratie**, zonder lege headercontainer of resterende verticale ruimte.
3. Breid het schema en de clienttypes voor de bestaande groepenlijst additief uit met `project_totals`. Elke entry bevat minimaal de stabiele projectidentificatie, projectnaam en het geformatteerd bruikbare totaal `person_hours`.
4. Hergebruik exact de bestaande filterbasis en deduplicatielogica van de groepenlijst. Pas filters toe, sluit soft-deleted groepen uit voor dit actieve overzicht, dedupliceer groepen, aggregeer vervolgens per project de `person_hours`, en pas pas daarna sortering/pagination voor `items` toe. `project_totals` is dus volledig en niet pagina-lokaal.
5. Render de compacte projecttotalen rechtsboven. De frontend gebruikt uitsluitend `project_totals`, niet de huidige pagina-items, en hanteert de bestaande duurformattering. Op smalle schermen mag de sectie onder de heading stapelen.
6. Verwijder alleen de zichtbare groeps- en personenstatistieken/-totalen uit het oude overzicht. Behoud overige lijst-, filter- en registratiefunctionaliteit.

## Implementation steps (ordered)
1. **Contract en querybasis vastleggen**
   - Leg de huidige list-query, filter- en deduplicatiepaden, actieve soft-delete-semantiek en bestaande `person_hours`-definitie vast.
   - Definieer het additieve `project_totals`-schema met `project_id`, `project_name` en `person_hours`; behoud alle bestaande lijstresponsevelden ongewijzigd.
2. **Server-side aggregatie**
   - Bouw de volledige actieve, gefilterde en gededupliceerde groepsset met dezelfde filters als de list response, exclusief pagination.
   - Aggregeer `person_hours` per project op die set vóór item-sortering en pagination.
   - Voeg `project_totals` toe aan iedere succesvolle groepenlijstrespons, inclusief lege resultaten, zonder nieuwe queryparameters of routes.
3. **Frontendcontract en overzicht**
   - Actualiseer de frontend-API-types en fixtures voor het optionele/additieve responseveld.
   - Vervang de persoonlijke client-side aggregatie door rendering van servergeleverde projecttotalen voor alle personen; toon een toegankelijke lege toestand wanneer de set leeg is.
4. **Terminologie en layout**
   - Wijzig zichtbare navigatie- en paginatermen naar **Urenregistratie**.
   - Vervang de header door uitsluitend de semantische heading en plaats de projecttotalen rechtsboven op desktop, met bruikbaar stapelen op kleine schermen.
   - Verwijder zichtbare groepsaantallen, persoonstellingen, totale groepuren en het oude totaal person-hours-overzicht.
5. **Tests en documentatie**
   - Voeg backendcontracttests toe voor complete projecttotalen over meerdere pagina's, filters, actieve/deleted data en deduplicatie.
   - Voeg frontendregressies toe voor labels, header, servergeleverde projecttotalen, lege toestand, afwezigheid van oude statistieken en behouden filter-/registratieinteracties.
   - Werk `docs/urenregistratie.md` bij voor de nieuwe naam en betekenis van het projectoverzicht. Voeg bij afgeronde implementatie een korte eindgebruikersgerichte About/changelog-entry toe.
6. **Verificatie en evidence**
   - Voer de opdrachten uit het Testing plan uit, noteer feitelijke uitkomsten onder **Verification evidence** en wijzig de status pas naar Completed als alle acceptance criteria zijn aangetoond.

## Acceptance criteria
1. De zichtbare urennavigatielink en urenpagina gebruiken **Urenregistratie**; route en bestaande API-paden blijven ongewijzigd.
2. Bovenaan de urenpagina staat precies één zichtbare primaire heading **Urenregistratie**. De eerdere eyebrow **Urenverantwoording** en tekst `Registreer groepen compact inline; projecten en globale posten beheer je centraal in Admin.` zijn niet zichtbaar of toegankelijk in de paginakop.
3. Elke succesvolle `GET /api/urenverantwoording/groepen`-respons bevat een additief `project_totals`-veld. Bestaande responsevelden, queryparameters, routes en item-pagination blijven backward-compatible ongewijzigd.
4. Elke `project_totals`-entry bevat `project_id`, `project_name` en numerieke `person_hours`; er is precies één entry per project in de actieve, gefilterde, gededupliceerde basisset.
5. `project_totals` wordt berekend vóór pagination: met meer overeenkomende groepen dan `page_size` is de waarde op pagina 1 en pagina 2 gelijk en omvat deze alle overeenkomende actieve groepen.
6. De aggregatie gebruikt dezelfde toegepaste lijstfilters als de response, sluit soft-deleted groepen uit en telt een gedupliceerde groep hoogstens eenmaal mee. De som per project volgt de bestaande `person_hours`-semantiek en omvat alle deelnemers, niet uitsluitend de ingelogde gebruiker.
7. Het overzicht toont uitsluitend de servergeleverde totale person-hours per project. Het bevat geen zichtbare groepsaantallen, persoonstellingen, totale groepuren, oude algemene person-hours-statistiek of persoonlijke gebruikersfiltering.
8. Op desktop staat het projectoverzicht rechtsboven in de urencontent. Bij 320 CSS px zijn heading, overzicht en primaire registratiebediening zonder horizontale viewportoverflow bereikbaar.
9. De overzichtssectie heeft een toegankelijke naam; projectnamen en urentotalen zijn leesbaar met toetsenbord en schermlezer; bestaande interactieve filter- en registratiecontrols blijven bedienbaar.
10. De urenhandleiding gebruikt de nieuwe user-facing naam en beschrijft projecttotalen voor alle personen. De About/changelog bevat bij afgeronde implementatie een korte gebruikersgerichte vermelding.
11. De gerichte backend- en frontendtests, frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Backend: contract, volledige aggregatie vóór pagination, filters en deduplicatie
cd backend
pytest tests/test_work_hours_api.py -q

# Frontend: urenpagina-, navigatie- en About/changelog-regressies
cd ../frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige frontendregressieset en productiebuild
npm test -- --run
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Maak meer passende groepen dan de kleinste `page_size`, verdeeld over minimaal twee projecten en met meerdere deelnemers; vergelijk projecttotalen op pagina 1 en 2 met handmatig berekende person-hours.
- Pas elk ondersteund lijstfilter afzonderlijk en gecombineerd toe; controleer dat projecttotalen alleen de volledige overeenkomende actieve set bevatten, ongeacht de geladen pagina.
- Verwijder een passende groep soft; bevestig dat diens uren niet in `project_totals` voorkomen en dat de bestaande deleted/history-flow intact blijft.
- Controleer een lege gefilterde set, desktop en 320 CSS px, inclusief toetsenbordnavigatie, focus en bereikbaarheid van filters en createcontrols.

## Risk + rollback plan

### Risks and mitigations
- **Aggregatie wijkt af van de list-filterbasis of deduplicatie:** centraliseer/hergebruik de bestaande gefilterde gededupliceerde querybasis; dek individuele en gecombineerde filters plus duplicate-gevoelige deelnemers met API-tests af.
- **Totals worden per pagina berekend:** test expliciet met meer records dan `page_size` en vergelijk pagina 1 en 2 met hetzelfde volledige totaal.
- **Soft-deleted groepen worden meegeteld:** definieer en test de actieve basis expliciet; behoud bestaande deleted/history-weergave los van dit overzicht.
- **Additief contract breekt oude clients:** maak `project_totals` alleen additioneel, zonder wijziging van bestaande velden, routes, queryparameters of paginationsemantiek; frontend moet een ontbrekend veld defensief als lege lijst kunnen weergeven gedurende rolling deployment.
- **Terminologie/layout schaadt mobiel of a11y:** gebruik bestaande responsive patronen, een benoemde sectie en handmatige 320 px/toetsenbordcontrole.

### Rollback
1. De contractwijziging is additief en vereist geen database- of datamigratie; oudere clients blijven de response kunnen consumeren.
2. Bij regressie revert de gewijzigde backend-, frontend-, test-, documentatie- en changelogcommit(s) als één change.
3. Herhaal na rollback minimaal `pytest tests/test_work_hours_api.py -q`, de gerichte frontendtests, `npm run build` en `git diff --check`.

## Notes / links
- Bestaande urenmodule: `opsx/changes/2026-07-30-urenverantwoordingsmodule.md`.
- Gerelateerde UI-specs: `opsx/changes/2026-08-12-urenverantwoording-invoer-ux-verfijning.md` en `opsx/changes/2026-08-12-urenverantwoording-admin-tabs.md`.
- Waarschijnlijke implementatiepunten:
  - `backend/app/api/work_hours.py`
  - `backend/app/schemas/work_hours.py`
  - `backend/app/services/work_hours_service.py`
  - `backend/tests/test_work_hours_api.py`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/app/App.test.tsx`
  - `docs/urenregistratie.md`
- **User approval:** the user explicitly approved this amendment on 2026-08-12, including the backward-compatible server-side `project_totals` field on the existing paginated groups-list response.

### Assumptions
- “Person-hours” has the existing domain meaning: the group duration is counted once for every active participant; the aggregate therefore uses the existing per-group `person_hours` value.
- “Full filtered active/deduplicated data” means the active (not soft-deleted) groups after all currently supplied list filters and existing deduplication, before pagination. The `include_deleted` and `deleted_only` list views do not change this active project-summary basis.
- Projecttotalen follow the applied list filters but are intentionally independent of the requested page, page size and item sort order.
- Only user-facing text is renamed; the internal name `urenverantwoording`, existing URL and API endpoints remain unchanged.

## Current status
Partial — implementation, documentation/changelog updates, automated verification and review are complete. Manual responsive and accessibility acceptance remains pending because no browser-capable tooling is available in this environment. Follow-up: perform the manual desktop/320 CSS px, keyboard/focus, screen-reader, filter, empty-state and deleted-group checks before marking this change Completed.

## What changed
- Original active spec created for approved terminology, header and personal-overview refinement.
- Pre-implementation inspection found the paginated-list blocker: client-side aggregation from loaded items would omit later pages. No product code, tests, documentation or changelog were changed while blocked.
- User-approved scope amendment recorded: personal overview replaced by project-level total person-hours across all people, and server-side `project_totals` on the existing paginated groups-list response explicitly authorized.
- Added the additive `project_totals` list-response field (`project_id`, `project_name`, `person_hours`). The repository aggregates it from the complete filtered, active and deduplicated group basis before item pagination, including for deleted-list views where the summary intentionally remains active-only.
- Replaced the old header and aggregate statistics with the accessible, server-fed **Projecttotalen** overview at the upper right; it stacks below the heading on narrow layouts and has a defensive empty state for rolling deployments.
- Renamed affected user-facing navigation, Admin project-visibility labels, documentation and changelog language to **Urenregistratie**. Added About/changelog iteration 104.
- Added backend pagination/filter/deduplication and soft-deletion contract assertions, plus frontend regressions for the new heading, totals and empty state.
- Extended the backend `project_totals` regression coverage with the existing API fixtures and semantics: `work_date`, `project_id`, `post_id`, free-text query, participant query, all of those filters combined, and an empty result set. The scenario also keeps an explicitly soft-deleted matching group out of all active totals.
- Repaired the project-total UI state handling: loading and request errors now have distinct feedback; the successful-empty message is shown only after a successful response, including a successful rolling-deployment response without optional `project_totals`.

## How to verify
- Run `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py -q` (or use an equivalent environment with the dependencies from `backend/pyproject.toml` installed).
- Run `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`, then `npm test -- --run` and `npm run build`.
- Run `git diff --check` from the repository root.
- Manually verify project totals across pages, each filter, a deleted group, and at 320 CSS px as listed in the **Testing plan**.

## Verification evidence
- Prior blocker evidence preserved: `UrenverantwoordingPage.tsx` calls `listWorkHourGroups` with `page` and a selectable `page_size` of 25, 50 or 100, then renders only `groupsQuery.data.items`. The backend validates the same page-size limit and returns a paginated list; deriving totals from loaded items would omit later pages.
- The prior no-new-request/no-contract-change boundary conflicted with the requirement for complete personal totals. The approved amendment supersedes that boundary by explicitly authorizing additive server-side `project_totals` calculated before pagination.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 test files passed, 115 tests passed.
- PASS — `cd frontend && npm test -- --run` → 5 test files passed, 178 tests passed.
- PASS — `cd frontend && npm run build` → TypeScript build and Vite production build succeeded. Vite reported only its existing chunk-size warning for a 517.53 kB JavaScript chunk.
- PASS — `git diff --check` → no whitespace errors.
- PASS — `cd backend && python3 -m py_compile app/repositories/work_hours_repository.py app/schemas/work_hours.py app/services/work_hours_service.py tests/test_work_hours_api.py` → syntax compilation succeeded.
- Repair round 1: updated coupled navigation and test expectations for the terminology rename. Repair round 2: made the new asynchronous project-total test wait for the query result. Both focused frontend tests then passed.
- PASS — `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py -q` → 82 passed in 53.99s. The run emitted 463 existing dependency deprecation warnings: one unset `pytest-asyncio` loop-scope warning, one `passlib` `crypt` warning, and 461 `python-jose` `datetime.utcnow()` warnings.
- PASS — focused backend suite rerun after final diff review: `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py -q` → 82 passed in 54.08s, with the same 463 dependency deprecation warnings.
- PASS — `cd backend && python3 -m py_compile app/repositories/work_hours_repository.py app/schemas/work_hours.py app/services/work_hours_service.py tests/test_work_hours_api.py` → syntax compilation succeeded.
- PASS — `git diff --check` after the regression repair → no whitespace errors.
- No browser-capable tooling is exposed in this environment. The manual desktop/320 CSS px keyboard/focus, empty-state/filter and deleted-group UI checks were not run and are not claimed as verified.
- Repair round 0 for this grouped review repair: added all clearly coupled backend filter/empty-result `project_totals` regressions in one change; no test-failure repair was needed.
- Repair round 1 for this review repair: corrected the successful-response assertions to wait for the asynchronous query to settle rather than asserting the initially rendered loading state.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → 1 test file passed, 28 tests passed, including focused pending, rejected, successful-empty and missing-optional-`project_totals` states.
- PASS — `cd frontend && npm run build` → TypeScript and Vite production build succeeded. Vite emitted only its existing chunk-size warning for a 517.70 kB JavaScript chunk.
- PASS — `git diff --check` → no whitespace errors.
- Review outcome: automated review found and resolved the coupled terminology expectations and asynchronous project-total assertions; the grouped backend review added coverage for all in-scope filters, empty results and soft-deleted exclusions. No unresolved automated issues remain. Manual browser/responsive/accessibility acceptance was not claimed or completed.

---
Status: partial; automated completion verified, manual responsive/accessibility acceptance pending
Owner: —
Date: 2026-08-12
