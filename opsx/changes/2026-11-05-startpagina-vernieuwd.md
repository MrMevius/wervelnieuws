# Title

Startpagina: functies en coöperaties duidelijker en levendiger

## Context

De startpagina na inloggen toont een korte opsomming van drie onderdelen en een kale lijst met coöperatienamen. Nieuwe gebruikers krijgen daardoor weinig beeld van wat WindWilly kan en wie erachter zitten.

## Goals / Non-goals

### Goals

- Een hero met een korte, warme introductie en drie draaiende windmolens in de kleuren van de coöperaties (stil bij `prefers-reduced-motion`).
- Kaarten voor alle onderdelen (Vergaderborden, Urenregistratie, Participatiemomenten, Wervelnieuws, WindWilly-assistent als "Binnenkort"), elk met korte uitleg en een link.
- Per coöperatie een kaart met plaats, oprichtingsjaar, één of twee zinnen en een link naar de eigen website.
- Een korte regel over Groene Noabers en Energiepark Daarle.
- Changelog-items voor deze iteratie en, met terugwerkende kracht, voor de admin-opmaak van dezelfde dag.

### Non-goals

- Geen wijziging in navigatie, routes of rechten.

## Proposed approach

Nieuwe component `frontend/src/app/shell/WindWillyLandingPage.tsx` (de oude versie is uit `AppShell.tsx` gehaald) en nieuwe `windwilly-home-*`- en `windwilly-cooperative*`-stijlen in `styles.css`.

Inhoud over de coöperaties komt van hun eigen websites (geraadpleegd 2026-11-05):

- energiekdaarle.nl: opgericht 9 april 2021 vanuit Plaatselijk Belang Daarle, doel energieneutraal Daarle in 2030, beheer gebiedsfonds zonnepark, zon-op-dak, samen met Duurzaam Daarlerveen werken aan windenergie langs de Stouwe.
- duurzaamdaarlerveen.nl: geregistreerd 12 april 2022, initiatief van inwoners, besparen en zon op dak, via Groene Noabers 50% van Energiepark Daarle, Windpark De Boldijk.
- noaber.co: sinds 2011, begonnen als Reggestroom, "de eerste energiecoöperatie in Overijssel", Zonnepark Haarle; via Groene Noabers wordt de omgeving voor de helft eigenaar van Energiepark Daarle.
- energieparkdaarle.nl: 5 tot 7 windturbines tussen Daarle en Hoge Hexel (Noaber & Co; energieparkdaarle.nl noemt 4 tot 7).

### Vervolg: slogan en Groene Noabers

- De slogan "Wij draaien mee" van groenenoabers.nl staat onder de draaiende windmolens (op mobiel onder de introductie).
- Groene Noabers heeft een eigen, uitgelichte kaart boven de drie coöperaties, in plaats van de losse regel onderaan. Bron (groenenoabers.nl, geraadpleegd 2026-11-05): "Coöperatie Groene Noabers is een samenwerking van" Energiek Daarle, Noaber & Co en Duurzaam Daarlerveen; "een groeiende beweging van ondernemers, inwoners en lokale organisaties"; "wat hier wordt ontwikkeld, ook van hier moet zijn"; "Groene Noabers is voor 50% mede-eigenaar vanaf de ontwikkelfase" van Energiepark Daarle.

## Acceptance criteria

1. Elke functiekaart linkt naar het bestaande onderdeel; externe links openen in een nieuw tabblad.
2. De pagina is bruikbaar op mobiel en in licht en donker thema.
3. De windmolens bewegen niet bij `prefers-reduced-motion: reduce`.

## Verification evidence

Zie PR: `tsc -b`, de volledige frontend-testsuite en `backend/tests/test_meta_and_me.py` slagen; screenshots van de echte component (donker, licht, mobiel) zijn gecontroleerd.
