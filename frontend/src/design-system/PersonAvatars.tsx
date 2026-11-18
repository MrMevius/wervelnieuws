import { useState } from "react";
import { getBoardUserAvatarUrl } from "../lib/api/client";
import "./person-avatars.css";

export type AvatarPerson = { key: string; name: string; avatarUserId?: string | null };

const AVATAR_LIMIT = 8;

function initials(name: string) {
  // Only words that start with a letter: "Rikus (EPD)" becomes "R", not "R(".
  const parts = name.trim().split(/\s+/).filter(part => /^\p{L}/u.test(part));
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?")[0];
  return letters.toUpperCase();
}

function PersonAvatar({ person }: { person: AvatarPerson }) {
  const [failed, setFailed] = useState(false);
  return <span className="person-avatar">{person.avatarUserId && !failed
    ? <img src={getBoardUserAvatarUrl(person.avatarUserId)} alt="" loading="lazy" onError={() => setFailed(true)} />
    : initials(person.name)}</span>;
}

// Photos only in the row; hover or focus shows everyone by name.
export function PersonAvatars({ people, label = "Aanwezig" }: { people: AvatarPerson[]; label?: string }) {
  const names = people.map(person => person.name);
  const visible = people.length > AVATAR_LIMIT ? people.slice(0, AVATAR_LIMIT - 1) : people;
  return <div className="person-avatars" role="img" tabIndex={0} aria-label={label + ": " + names.join(", ")}>
    <div className="person-avatar-stack">{visible.map(person => <PersonAvatar key={person.key} person={person} />)}{people.length > visible.length && <span className="person-avatar person-avatar-more">+{people.length - visible.length}</span>}</div>
    <div className="person-avatars-tooltip" aria-hidden="true"><strong>{label} ({names.length})</strong><ul>{names.map((name, index) => <li key={index}>{name}</li>)}</ul></div>
  </div>;
}
