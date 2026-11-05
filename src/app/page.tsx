import styles from "./page.module.css";
import WorldCanvas from "@/components/world/WorldCanvas";
import MirrorDisclosure from "@/components/MirrorDisclosure";
import { affiliation, contact, experience, profile, projects } from "@/data/content";
import { skillGroups } from "@/data/content";

/* Keep a complete server-rendered reading version available as a fallback. */

const SECTIONS = [
  { id: "top", label: "Home" },
  { id: "work", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

export default function Home() {
  const featured = projects.filter((project) => project.featured);
  const secondary = projects.filter((project) => !project.featured);

  return (
    <WorldCanvas>
      <div className={styles.mirror}>
        <nav className={styles.nav} aria-label="Sections">
          <p className={styles.wordmark}>{profile.name}</p>
          <ul>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} data-world={`nav-${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section className={styles.band} id="top">
          <div className={`${styles.inner} ${styles.hero}`}>
            <p className={styles.supporting}>{profile.role}</p>
            <h1>{profile.name}</h1>
            <p className={styles.lead}>
              {profile.introduction}
            </p>
            <p>
              {profile.about}
            </p>
            <p className={styles.actions}>
              <a href="#work" data-world="cta-work">
                View projects
              </a>
              <a href="#contact" data-world="cta-contact">
                Get in Touch
              </a>
            </p>
            <h2>Education and recognition</h2>
            <p>
              <strong>{affiliation.school}</strong> — {affiliation.degree},{" "}
              {affiliation.expected}, {affiliation.gpa}.
            </p>
            <p>Coursework in {affiliation.coursework}.</p>
            <p>{affiliation.recognition}</p>
          </div>
        </section>

        <section className={styles.band} id="work">
          <div className={styles.inner}>
            <h2>Selected projects</h2>
            <p>{profile.projectsIntro}</p>
            {featured.map((project, index) => (
              <article key={project.name}>
                <h3>{project.name}</h3>
                <p>{project.focus}</p>
                <MirrorDisclosure
                  name={project.name}
                  worldId={`project-${index}`}
                  verb="account"
                >
                  <p>
                    <strong>{project.metric}</strong>
                  </p>
                  <p>{project.summary}</p>
                  {project.detail && <p>{project.detail}</p>}
                </MirrorDisclosure>
                {project.technologies.length > 0 && <p>Built with {project.technologies.join(", ")}.</p>}
              </article>
            ))}
            <h3>More Projects</h3>
            <ul className={styles.rows}>
              {secondary.map((project) => (
                <li key={project.name}>
                  <strong>{project.name}</strong><p>{project.summary}</p><p>{project.metric}</p>
                  {project.technologies.length > 0 && <p>Built with {project.technologies.join(", ")}.</p>}
                  {project.detail && <details><summary>Project details</summary><p>{project.detail}</p></details>}
                </li>
              ))}
            </ul>
            <p><a href={contact.github} target="_blank" rel="noopener noreferrer">More on GitHub ↗</a></p>
          </div>
        </section>

        <section className={styles.band} id="experience">
          <div className={styles.inner}>
            <h2>Experience</h2>
            <p>{profile.experienceIntro}</p>
            {experience.map((entry, index) => (
              <article key={entry.name}>
                <h3>{entry.name}</h3>
                <p>{entry.focus}</p>
                <MirrorDisclosure
                  name={entry.name}
                  worldId={`entry-${index}`}
                  verb="pipeline"
                >
                  <p>
                    <strong>{entry.metric}</strong>
                  </p>
                  <p>{entry.summary}</p>
                  <p>{entry.detail}</p>
                </MirrorDisclosure>
                <p>Tools: {entry.technologies.join(", ")}.</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.band} id="skills">
          <div className={styles.inner}>
            <h2>Skills & tools</h2>
            <p>{profile.skillsIntro}</p>
            {skillGroups.map((group, index) => (
              <div key={group.label}>
                <h3>{group.label}</h3>
                <MirrorDisclosure
                  name={group.label}
                  worldId={`skill-${index}`}
                  verb="tools"
                >
                  <p>{group.items.join(", ")}</p>
                </MirrorDisclosure>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.band} id="contact">
          <div className={styles.inner}>
            <h2>Get in touch</h2>
            <p>
              {profile.contactIntro}
            </p>
            <ul className={styles.rows}>
              <li>
                <a href={`mailto:${contact.email}`} data-world="contact-email">
                  {contact.email}
                </a>
              </li>
              <li>
                <a
                  href={contact.linkedin}
                  data-world="contact-linkedin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contact.linkedinLabel}
                </a>
              </li>
              <li>
                <a
                  href={contact.github}
                  data-world="contact-github"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contact.githubLabel}
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </WorldCanvas>
  );
}

