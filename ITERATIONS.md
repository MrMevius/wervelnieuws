Iteratie #15
- Voeg een extra hoofdpagina toe naasr urenverantwoording genaamd > Trello
- Zet hier een placeholder op, we gaan trello nabouwen voor onze eigen projeten
- Maak de achtergrond van deze pagina lijkend op Trello
- 

Iteratie #14
- Wervelnieuws: haal op de main page het bovenste blok weg (welkom user)
- In het submenu hernoem database naar bronbestanden 
- In database, maak de default weergave dat je alle bestanden van alle projecten ziet
- 

Iteratie #13
- Graag de gehele app Wervelnieus een subpagina maken van WindWilly
- Het accountbeheer van Wervelnieuws geld ook voor Windwily
- Naast wervelnieuws komt ook 'windwilly' (maak placeholder, dit wordt een soort ChatGPT waar wij alle windprojectgerelateerde vragen aan kunnen stelln 
- Daarnaast komt ook de subpagina 'urenverantwoording' (maak hier ook een placeholder van)
- Daarnast komt ook de subpagina 'participatiemomenten'(maak hier ook een placeholder van)
- Stel me alle benodigde vragen om de iteratie duidelijker te krijgen 1 voor 1 als mc vragen

Iteratie #12
- Json endpoint genereen waar n8n op aan kan sluiten
- Hier alle foutmeldingen/succesmeldingen op presenteren
- n8n regelt de notificatieafhandeling voor admins via Telegram

Iteratie #11
- De hoofdpagina log uitwerken.
- Leg 1 voor 1 feature suggesties voor

Iteratie #10
- Knip het admin menu op in tabjes: gebruikersbeheer, projecten, thema's, AI, sceduler
- Geef de admin op de ai thema pagina de mogelijkheid om thema's te beheren
- Voeg enkele logische scedules toe
- Geef nog een feature suggestie voor de admin pagina

Iteratie #10
- breid de planning uit met:
- project

Iteratie #09
- Tekstgeneratie ontwikkelen
- Op basis van ondererp voor de drie doelmedia een tekst genereren
- Aanvullende info uit het infoveld meenemen
- Waarnodig informatie uit bestanden in de database meenemen
- In het admin menu een pagina waar de genai config te bedienen is (system prompt, OpenAI API integratie, andere suggesties)
- Mogelijkheid voor genai to websearch inbouwen

Iteratie #08
- Pas de Planningsregel detail (dummy) pagina aan
- Bouw 'm logischer op, ga efficiënter om met de beschikbare ruimte
- Er worden per doelmedia een seperaat bericht en afbeelding gegenereerd, geef dus ook ruimte aan deze drie verschillende artikelen (bij voorkeur naast elkaar, overzichtelijk)
- Geef d.m.v. een wysiwyg editor edit mogelijkheden
- Maak het opmerkingenveld vrij invulbaar voor de GenAI waar additionele informatie in staat die gebruik moet worden bij het genereren van het artikel
- Maak een knop dat je als gebruiker opnieuw de artikelen kunt genereren
- Geef de gebruiker de mogelijkheid om per doelmedia de artikelen/afbeeldingen goed te keuren
- 

Iteratie #07
- Importmogelijkheid toevoegen aan de planning
- Accepteer CSV met vaste kolommen
- Mogelijkheid tot toevoegen individuele planningsregels
- Logica: elke planningsregel is 1 bericht
- Breidt de kolom uit met doelmediums (dus Facebook, Nieuwsbrief, Website), dit is aan of uit te vinken met medium
- Mogelijkheid tot het verwijderen van regels

Iteratie #06
- verwijder de upload file functionalitieit van de main page
- voeg een drag en drop upload functionaliteit toe aan de database page
- Geef inzicht in welke files er staan en wie deze geupload heeft,wanneer deze geupload zijn
- Mogelijkheid geven om aan te geven tot welk project de bestanden horen
- In het admin menu moet een bewerkbare lijst komen met projecten
- Voeg nu alvast 1 project toe 'Windpark de Boldijk'

Iteratie #07
- Maak de Database-bronbestanden doorzoekbaar voor AI (indexering + retrieval/RAG)
- Laat AI-generatie relevante passages met bronverwijzing uit deze database ophalen
- Houd dit los van de topic-uploadflow; combineer beide bronnen gecontroleerd
- Voeg zichtbaarheid toe van welke bronpassages gebruikt zijn in gegenereerde output

Iteratie #05
- Graag een admin menu toevoegen (klikken op je username en dan naast settings ook een admin page)
- Voor nu dit admin menu alleen koppelen aan de user admin
- In het admin menu kunnen de admins rechten geven aan bepaalde users (iedereen is user, sommige zijn ook admin)

Itratie #04
- Laat gebruikers hun eigen profielfoto kunnen uploaden
- Na het uploaden moeten ze deze foto kunnen bijsnijden tot een mooie cirkel zodat deze gebruikt kan worden

Iteratie #03
- user settings menu aanpassen
- Mogelijkheid tot kiezen dark mode
- Mogelijkheid tot opgeven en wijzigen volledige naam
- Mogelijkheid tot opgeven en wijzigen e-mailadres
- Suggestie geven welke user settings nog meer relevant zijn

Iteratie #02
- Geef de pagina een volledige nieuwe look en feel
- bovenin beeld verschillende tabjes
- Tab bar: main, planning, database, log, about > helemaal rechts de gebuikersnaam
- Als je op de gebruikersnaam klikt kun je naar settings en uitloggen
- Maak voor de settings pagina nu een dummy aan
- Main = dummy (welkom [gebruiker], upload hier je bestanden, aantal succesvolle plaatsingen per platform, volgende geplande bericht per platform)
- log = dummy
- About is korte uitleg wat dit voor applicatie is + daaronder een changelog die elke iteratie bijgehouden wordt. Zo functioneel mogelijk dat een niet technisch iemand het kan snappen
- About geeft ook een korte disclaimer en geeft aan dat dit ontwikkelt is door Energiek Daarle
- Planningspaging geeft een tabel weer met de kolommen: ID	Onderwerp	Thema	Status	Geplande datum	Plaatsingdatum	Illustratie	Opmerkingen																			
- 
