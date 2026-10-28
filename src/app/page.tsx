import styles from "./page.module.css";
import WorldCanvas from "@/components/world/WorldCanvas";
import MirrorDisclosure from "@/components/MirrorDisclosure";
import { affiliation, contact, experience, projects } from "@/data/content";
import { skillGroups } from "@/data/content";

/* Keep a complete server-rendered reading version available as a fallback. */

const SECTIONS = [
  { id: "top", label: "Home" },
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Capabilities" },
  { id: "contact", label: "Contact" },
];

export default function Home() {
  const featured = projects.filter((project) => project.featured);
  const secondary = projects.filter((project) => !project.featured);

  return (
    <WorldCanvas>
      <div className={styles.mirror}>
        <nav className={styles.nav} aria-label="Sections">
          <p className={styles.wordmark}>Nicolas Villegas-Kirchman</p>
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
            <p className={styles.supporting}>Applied ML × Software Engineering</p>
            <h1>Nicolas Villegas-Kirchman</h1>
            <p className={styles.lead}>
              Software engineer building the ML systems — and the infrastructure
              that runs them in production.
            </p>
            <p>
              Two disciplines, one practice: real-time data pipelines,
              diagnostic imaging systems, and the distributed infrastructure
              underneath both.
            </p>
            <p className={styles.actions}>
              <a href="#work" data-world="cta-work">
                View Selected Work
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
            <h2>Selected Work</h2>
            <p>Applied ML, shipped.</p>
            {featured.map((project, index) => (
              <article key={project.name}>
                <h3>{project.name}</h3>
                <MirrorDisclosure
                  name={project.name}
                  worldId={`project-${index}`}
                  verb="account"
                >
                  <p>
                    <strong>{project.metric}</strong>
                  </p>
                  <p>{project.summary}</p>
                  <p>{project.detail}</p>
                </MirrorDisclosure>
              </article>
            ))}
            <h3>More Projects</h3>
            <ul className={styles.rows}>
              {secondary.map((project) => (
                <li key={project.name}>
                  <strong>{project.name}</strong> — {project.metric}.{" "}
                  {project.summary}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.band} id="experience">
          <div className={styles.inner}>
            <h2>Experience</h2>
            <p>Systems in production.</p>
            {experience.map((entry, index) => (
              <article key={entry.name}>
                <h3>{entry.name}</h3>
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
              </article>
            ))}
          </div>
        </section>

        <section className={styles.band} id="skills">
          <div className={styles.inner}>
            <h2>Technical Capabilities</h2>
            <p>Tools of the practice.</p>
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
              Open to conversations about applied ML, systems engineering, or
              roles where both meet.
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
            <p>
              <strong>Stack —</strong> Python, JavaScript, TypeScript, React,
              Next.js, Django, FastAPI, PyTorch, TensorFlow, PostgreSQL, Docker,
              Terraform, AWS, Kafka.
            </p>
          </div>
        </section>
      </div>
    </WorldCanvas>
  );
}

