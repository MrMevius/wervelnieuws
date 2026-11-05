import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { WERVEL_PATHS, WINDWILLY_PATHS } from "../routes/paths";

type Module = { title: string; to: string; text: string; icon: ReactNode; soon?: boolean };

const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const MODULES: Module[] = [
  {
    title: "Vergaderborden",
    to: WINDWILLY_PATHS.vergaderborden,
    text: "Acties en afspraken per project op één bord. Met updates, bijlagen en opnames van het overleg die automatisch worden uitgeschreven en samengevat.",
    icon: <svg {...iconProps}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></svg>
  },
  {
    title: "Urenregistratie",
    to: WERVEL_PATHS.urenverantwoording,
    text: "Houd bij hoeveel tijd vrijwilligers aan elk project besteden, ook samen met mensen zonder account. Zo is altijd duidelijk wat er in een project zit.",
    icon: <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  },
  {
    title: "Participatiemomenten",
    to: "/participatiemomenten",
    text: "Gesprekken met omwonenden, informatieavonden en gemaakte afspraken op één plek vastgelegd, gekoppeld aan het project.",
    icon: <svg {...iconProps}><path d="M4 5h11v8H8l-4 3z" /><path d="M15 9h5v8l-3-2h-6v-2" /></svg>
  },
  {
    title: "Wervelnieuws",
    to: WERVEL_PATHS.base,
    text: "Straks van bronstukken naar een bericht voor website, Facebook en nieuwsbrief. AI helpt met schrijven, wij controleren en publiceren.",
    icon: <svg {...iconProps}><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 8h3v9a2 2 0 0 1-2 2" /><path d="M7 9h7M7 12h7M7 15h4" /></svg>,
    soon: true
  },
  {
    title: "WindWilly-assistent",
    to: WINDWILLY_PATHS.module,
    text: "Een vraagbaak die antwoord geeft op basis van onze eigen bronnen. Nu nog een voorproefje.",
    icon: <svg {...iconProps}><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" /></svg>,
    soon: true
  }
];

type Cooperative = { name: string; place: string; since: string; text: string; url: string; site: string; tone: string };

const COOPERATIVES: Cooperative[] = [
  {
    name: "Energiek Daarle",
    place: "Daarle",
    since: "Sinds 2021",
    text: "Opgericht vanuit Plaatselijk Belang Daarle, met als doel een energieneutraal dorp in 2030. Beheert het gebiedsfonds van het zonnepark en werkt aan zon op dak.",
    url: "https://energiekdaarle.nl/",
    site: "energiekdaarle.nl",
    tone: "sun"
  },
  {
    name: "Duurzaam Daarlerveen",
    place: "Daarlerveen",
    since: "Sinds 2022",
    text: "Een initiatief van inwoners die vrijwillig de handen ineen slaan. Helpt met besparen en zon op dak en werkt samen met Energiek Daarle aan Windpark De Boldijk.",
    url: "https://www.duurzaamdaarlerveen.nl/",
    site: "duurzaamdaarlerveen.nl",
    tone: "leaf"
  },
  {
    name: "Noaber & Co",
    place: "Gemeente Hellendoorn",
    since: "Sinds 2011",
    text: "Begonnen als Reggestroom, de eerste energiecoöperatie van Overijssel. Bouwt aan wind- en zonneprojecten, zoals Zonnepark Haarle.",
    url: "https://noaber.co/",
    site: "noaber.co",
    tone: "sky"
  }
];

function Windmill({ tone }: { tone: string }) {
  return <svg className={`windwilly-home-windmill is-${tone}`} viewBox="0 0 120 160" aria-hidden="true">
    <path className="windwilly-home-windmill-tower" d="M57 58 L52 156 H68 L63 58 Z" />
    <g className="windwilly-home-windmill-rotor">
      <path d="M60 52 C57 36 58 16 60 4 C62 16 63 36 60 52 Z" />
      <path d="M60 52 C57 36 58 16 60 4 C62 16 63 36 60 52 Z" transform="rotate(120 60 55)" />
      <path d="M60 52 C57 36 58 16 60 4 C62 16 63 36 60 52 Z" transform="rotate(240 60 55)" />
      <circle cx="60" cy="55" r="4.5" />
    </g>
  </svg>;
}

export function WindWillyLandingPage() {
  return (
    <section className="main-dashboard windwilly-homepage">
      <header className="panel windwilly-home-hero" aria-labelledby="windwilly-home-title">
        <div className="windwilly-home-hero-copy">
          <p className="eyebrow">Groene Noabers · WindWilly</p>
          <h1 id="windwilly-home-title">Samen werken aan energie van hier</h1>
          <p className="windwilly-home-lead">
            WindWilly is de gezamenlijke werkplek van drie energiecoöperaties uit Daarle, Daarlerveen en de gemeente Hellendoorn.
            Hier plannen we, leggen we vast wat we doen en vertellen we de omgeving wat er speelt.
          </p>
        </div>
        <figure className="windwilly-home-windfarm">
          <div className="windwilly-home-windmills" aria-hidden="true">
            <Windmill tone="sun" />
            <Windmill tone="leaf" />
            <Windmill tone="sky" />
          </div>
          <figcaption className="windwilly-home-slogan">Wij draaien mee</figcaption>
        </figure>
      </header>

      <section className="panel windwilly-home-modules" aria-labelledby="windwilly-modules-title">
        <div className="windwilly-section-heading">
          <p className="eyebrow">Wat kun je hier?</p>
          <h2 id="windwilly-modules-title">Alles voor het werk achter de schermen</h2>
        </div>
        <ul className="windwilly-home-module-grid">
          {MODULES.map((module) => (
            <li key={module.title}>
              <Link to={module.to} className="windwilly-home-module" aria-label={`Naar ${module.title}${module.soon ? " (binnenkort)" : ""}`}>
                <span className="windwilly-home-module-icon">{module.icon}</span>
                <span className="windwilly-home-module-title">
                  {module.title}
                  {module.soon && <span className="windwilly-home-soon">Binnenkort</span>}
                </span>
                <span className="windwilly-home-module-text">{module.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel windwilly-cooperatives-panel" aria-labelledby="windwilly-cooperatives-title">
        <div className="windwilly-section-heading">
          <p className="eyebrow">Wie zitten erachter?</p>
          <h2 id="windwilly-cooperatives-title">Samen zijn we Groene Noabers</h2>
          <p className="muted">Drie energiecoöperaties uit de regio die samen de regie willen houden over de energie in hun eigen omgeving.</p>
        </div>
        <article className="windwilly-groene-noabers" aria-labelledby="windwilly-groene-noabers-title">
          <div className="windwilly-groene-noabers-copy">
            <p className="windwilly-groene-noabers-slogan">Wij draaien mee.</p>
            <h3 id="windwilly-groene-noabers-title">Coöperatie Groene Noabers</h3>
            <p>
              De samenwerking van Energiek Daarle, Duurzaam Daarlerveen en Noaber &amp; Co: een groeiende beweging van ondernemers,
              inwoners en lokale organisaties. Wat hier wordt ontwikkeld, moet ook van hier zijn.
            </p>
            <p>
              Groene Noabers is vanaf de ontwikkelfase voor 50% mede-eigenaar van{" "}
              <a href="https://energieparkdaarle.nl/" target="_blank" rel="noopener noreferrer">Energiepark Daarle</a>,
              een windpark met 5 tot 7 turbines tussen Daarle en Hoge Hexel.
            </p>
          </div>
          <a href="https://www.groenenoabers.nl/" target="_blank" rel="noopener noreferrer" className="windwilly-cooperative-link">groenenoabers.nl ↗</a>
        </article>
        <ul className="windwilly-cooperatives-grid">
          {COOPERATIVES.map((cooperative) => (
            <li key={cooperative.name} className={`windwilly-cooperative windwilly-cooperative-${cooperative.tone}`}>
              <div className="windwilly-cooperative-head">
                <h3>{cooperative.name}</h3>
                <span className="windwilly-cooperative-meta">{cooperative.place} · {cooperative.since}</span>
              </div>
              <p>{cooperative.text}</p>
              <a href={cooperative.url} target="_blank" rel="noopener noreferrer" className="windwilly-cooperative-link">{cooperative.site} ↗</a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
