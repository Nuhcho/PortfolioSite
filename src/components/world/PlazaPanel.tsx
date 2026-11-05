"use client";
import { useEffect, useRef } from "react";
import { affiliation, contact, experience, profile, projects, skillGroups } from "@/data/content";
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
      <div><small>{stop?.number} / {stop?.landmark}</small><h2 id="plaza-panel-title">{stop?.title}</h2></div>
      <button onClick={onClose} aria-label="Close and return to plaza" autoFocus>×</button>
    </header>
    <div className={styles.panelBody} data-panel-body>
      {selected === "about" && <>
        <p className={styles.eyebrow}>{profile.role}</p>
        <h3>{profile.name}</h3><p>{profile.about}</p><p>{profile.approach}</p>
        <h3>Education</h3><p><strong>{affiliation.school}</strong><br/>{affiliation.degree}<br/>{affiliation.expected} · {affiliation.gpa}</p>
        <p>Coursework in {affiliation.coursework}.</p>
        <h3>Recognition</h3><p>{affiliation.recognition}</p>
        <button className={styles.textButton} onClick={() => onSelect("projects")}>Explore my projects →</button>
      </>}
      {selected === "projects" && <><p>{profile.projectsIntro}</p><p><a className={styles.inlineLink} href={contact.github} target="_blank" rel="noopener noreferrer">More on GitHub ↗</a></p></>}
      {selected === "experience" && <p>{profile.experienceIntro}</p>}
      {(selected === "projects" || selected === "experience") && entries.map(entry => <article key={entry.name}>
        <small>{selected === "projects" && entry.featured ? "Featured project · " : ""}{entry.category === "ml" ? "Applied ML" : "Software & systems"}</small>
        <h3>{entry.name}</h3><p className={styles.entryFocus}>{entry.focus}</p>
        <p>{entry.summary}</p><p className={styles.metric}>{entry.metric}</p>
        {entry.technologies.length > 0 && <ul className={`${styles.chips} ${styles.entryStack}`} aria-label={`${entry.name} technologies`}>{entry.technologies.map(tool => <li key={tool}>{tool}</li>)}</ul>}
        {entry.detail && <details><summary>{selected === "projects" ? entry.technologies.length > 0 ? "How it’s built" : "Project notes" : "My contribution"}</summary><p>{entry.detail}</p></details>}
      </article>)}
      {selected === "skills" && <><p>{profile.skillsIntro}</p>{skillGroups.map(group => <article key={group.label}><h3>{group.label}</h3><ul className={styles.chips}>{group.items.map(item => <li key={item}>{item}</li>)}</ul></article>)}</>}
      {selected === "contact" && <>
        <h3>Let’s work together.</h3><p>{profile.contactIntro}</p>
        <ul className={styles.contactLinks}>
          <li><a href={`mailto:${contact.email}`}><strong>Email me ↗</strong><span>{contact.email}</span></a></li>
          <li><a href={contact.linkedin} target="_blank" rel="noopener noreferrer"><strong>Connect on LinkedIn ↗</strong><span>My professional profile</span></a></li>
          <li><a href={contact.github} target="_blank" rel="noopener noreferrer"><strong>Explore my GitHub ↗</strong><span>Repositories and code</span></a></li>
        </ul>
      </>}
    </div>
    <nav className={styles.panelNav} aria-label="Portfolio sections">{PLAZA_STOPS.map(s => <button key={s.id} aria-current={selected === s.id ? "page" : undefined} onClick={() => onSelect(s.id)}>{s.number} {s.title}</button>)}</nav>
  </dialog>;
}
