"use client";
import { useEffect, useRef } from "react";
import { affiliation, contact, experience, projects, skillGroups } from "@/data/content";
import { PLAZA_STOPS, type PlazaStop } from "./plazaStops";
import styles from "./WorldCanvas.module.css";

export default function PlazaPanel({ selected, onClose, onSelect }: {
  selected: PlazaStop | null; onClose: () => void; onSelect: (id: PlazaStop) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected && !ref.current?.open) ref.current?.showModal();
    if (!selected) ref.current?.close();
    ref.current?.querySelector<HTMLElement>("[data-panel-body]")?.scrollTo(0, 0);
  }, [selected]);
  const stop = PLAZA_STOPS.find(s => s.id === selected);
  const entries = selected === "projects" ? projects : experience;
  return <dialog ref={ref} className={styles.panel} aria-labelledby="plaza-panel-title"
    onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <header className={styles.panelHeader}>
      <div><small>{stop?.number} / {stop?.label}</small><h2 id="plaza-panel-title">{stop?.title}</h2></div>
      <button onClick={onClose} aria-label="Close and return to plaza" autoFocus>×</button>
    </header>
    <div className={styles.panelBody} data-panel-body>
      {selected === "about" && <><p className={styles.eyebrow}>Applied ML × Software Engineering</p><h3>Nicolas Villegas-Kirchman</h3><p>Software engineer building the ML systems — and the infrastructure that runs them in production.</p><p>Real-time data pipelines, diagnostic imaging systems, and distributed infrastructure.</p><h3>Education & recognition</h3><p><strong>{affiliation.school}</strong><br/>{affiliation.degree}, {affiliation.expected}. {affiliation.gpa}.</p><p>{affiliation.recognition}</p><p>Coursework: {affiliation.coursework}.</p><button className={styles.textButton} onClick={() => onSelect("projects")}>Visit the project gallery →</button></>}
      {(selected === "projects" || selected === "experience") && entries.map(entry => <article key={entry.name}><small>{entry.category === "ml" ? "Applied ML" : "Systems engineering"}</small><h3>{entry.name}</h3><p className={styles.metric}>{entry.metric}</p><p>{entry.summary}</p><details><summary>Read the details</summary><p>{entry.detail}</p></details></article>)}
      {selected === "skills" && skillGroups.map(group => <article key={group.label}><h3>{group.label}</h3><ul className={styles.chips}>{group.items.map(item => <li key={item}>{item}</li>)}</ul></article>)}
      {selected === "contact" && <><h3>Let’s build something useful.</h3><p>Open to conversations about applied ML, systems engineering, or roles where both meet.</p><ul className={styles.contactLinks}><li><a href={`mailto:${contact.email}`}>{contact.email} ↗</a></li><li><a href={contact.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></li><li><a href={contact.github} target="_blank" rel="noreferrer">GitHub ↗</a></li></ul></>}
    </div>
    <nav className={styles.panelNav} aria-label="Explore another landmark">{PLAZA_STOPS.map(s => <button key={s.id} aria-current={selected === s.id ? "page" : undefined} onClick={() => onSelect(s.id)}>{s.number} {s.title}</button>)}</nav>
  </dialog>;
}
