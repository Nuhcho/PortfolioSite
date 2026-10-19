// No start/end dates: the source resume gives none, and inventing one would
// violate the no-fabrication rule in PRODUCT.md's Evidence on Hand. Entries
// are shown in resume order, not chronological order — the visual "flow"
// device used for Experience implies sequence, never specific dates.
//
// category/code: a status tag, assigned by what the entry's own headline
// metric actually proves — an accuracy/placement number is an ML claim, a
// throughput/scale/improvement number is a systems claim. This is the real
// axis PRODUCT.md's positioning rests on (applied ML *and* software
// engineering), not a decorative label.
export type Entry = {
  name: string;
  summary: string;
  metric: string;
  detail: string;
  category: "ml" | "systems";
  code: string;
  featured?: boolean;
};

export const experience: Entry[] = [
  {
    name: "Lumen Technologies",
    summary:
      "Real-time threat scoring across a national network, ML models running in production, not a notebook.",
    metric: "Millions of records / day",
    detail:
      "Built a distributed real-time threat scoring pipeline by deploying ML models into containerized Docker nodes, processing millions of network records daily using Kafka and PySpark. Two parallel pipelines — one per IP version — each retrain nightly on the past day's traffic, then score live records against that model: the IPv4 pipeline updates an existing score, the IPv6 pipeline adds a new one.",
    category: "systems",
    code: "SYS",
  },
  {
    name: "Kodely",
    summary:
      "An extraction system built to make a decade of textbooks searchable by meaning, not keyword.",
    metric: "10,000+ pages indexed",
    detail:
      "Built an extraction system handling 10,000+ textbook pages with vector database storage for semantic search applications. A RAG pipeline: Docling parses and extracts the textbook corpus, embeddings are stored in pgvector, and queries retrieve relevant chunks to generate an answer.",
    category: "systems",
    code: "SYS",
  },
  {
    name: "Actiontec",
    summary:
      "Mesh networking tuning on production WiFi 7 / 6E hardware, measured against real connectivity loss.",
    metric: "+40% connectivity",
    detail:
      "Focused on WiFi 7 / 6E optimization, achieving a 40% improvement in connectivity through mesh networking enhancements.",
    category: "systems",
    code: "SYS",
  },
];

// Cogniscan and OmniScanner are the featured pair: the two projects with the
// most concrete, externally-legible proof (a measured accuracy figure and a
// competition placement). Everything else runs as secondary/compact rows —
// none carries an accuracy or placement figure of its own.
export const projects: Entry[] = [
  {
    name: "Cogniscan",
    summary: "MRI analysis for early Alzheimer's assessment.",
    metric: "97.8% accuracy",
    detail:
      "An MRI analysis system for Alzheimer's assessment, reaching 97.8% accuracy against evaluated cases. Built as a full-stack application: a Django REST API fronting a PyTorch and OpenCV vision pipeline, served through a Next.js and Tailwind frontend.",
    category: "ml",
    code: "ML",
    featured: true,
  },
  {
    name: "OmniScanner",
    summary: "A cancer screening tool built for a national ML competition.",
    metric: "2nd place — ACM × Intel",
    detail:
      "A cancer screening tool that placed 2nd at the ACM × Intel hackathon, screened against competing teams' models.",
    category: "ml",
    code: "ML",
    featured: true,
  },
  {
    name: "Gastronomy",
    summary: "Django + TensorFlow (ResNet50) patch-based tissue classifier.",
    metric: "96.8% accuracy",
    detail:
      "A tissue classification system reaching 96.8% accuracy, applying the same imaging-ML approach to a second diagnostic domain. A Django REST API serves a patch-based classification pipeline built on TensorFlow (ResNet50), scikit-learn, and XGBoost.",
    category: "ml",
    code: "ML",
  },
  {
    name: "ARMSE",
    summary: "A cloud-distributed systems platform.",
    metric: "AWS-native, distributed",
    detail:
      "A cloud-distributed systems platform built on AWS infrastructure, the systems-engineering counterpart to the ML work above.",
    category: "systems",
    code: "SYS",
  },
  {
    name: "Distributed System Manager",
    summary: "Led backend on a team-built AWS systems manager.",
    metric: "Terraform-provisioned, AWS EC2",
    detail:
      "A distributed systems manager for provisioning and monitoring cloud infrastructure, built with a team. Led backend development (FastAPI, PostgreSQL) as the bulk of the work, with contributions to the Next.js/React frontend and to the Terraform-provisioned, Docker-containerized AWS EC2 infrastructure.",
    category: "systems",
    code: "SYS",
  },
  {
    name: "BroadbandNow Scraper",
    summary: "Selenium scraper cataloging ISP data across six connection types.",
    metric: "6 provider categories",
    detail:
      "A Selenium-based scraper that catalogs broadband provider data from BroadbandNow across 5G home internet, fiber, cable, fixed wireless, satellite, and DSL categories, exporting results to CSV.",
    category: "systems",
    code: "SYS",
  },
  {
    name: "USP Data Model Scraper",
    summary: "Extracts the Broadband Forum's TR-181 device data model to CSV.",
    metric: "TR-181 → structured CSV",
    detail:
      "A Selenium-based scraper that parses the Broadband Forum's TR-181 USP device data model specification and exports its full object and command hierarchy to structured CSV.",
    category: "systems",
    code: "SYS",
  },
];

export const contact = {
  email: "nicovk223405@gmail.com",
  linkedin: "https://www.linkedin.com/in/nuhchonvk/",
  linkedinLabel: "linkedin.com/in/nuhchonvk",
  github: "https://github.com/Nuhcho",
  githubLabel: "github.com/Nuhcho",
};

export const affiliation = {
  school: "Santa Clara University",
  degree: "B.E. Computer Science & Engineering",
  expected: "expected June 2027",
  gpa: "GPA 3.5",
  coursework:
    "architecture, algorithms, networking, machine learning, compilers, circuits",
  recognition: "Hack For Humanity Finalist · ACM × Intel Hack Winner",
};

// Grouped from PRODUCT.md's single confirmed stack line — grouping is an
// editorial/presentational choice, not new factual claims about which group
// a given tool "belongs" to on any specific project.
export const skillGroups: { label: string; items: string[] }[] = [
  { label: "Languages", items: ["Python", "JavaScript", "TypeScript"] },
  { label: "Web", items: ["React", "Next.js", "Django", "FastAPI"] },
  {
    label: "ML & Data",
    items: ["PyTorch", "TensorFlow", "scikit-learn", "XGBoost", "OpenCV", "PostgreSQL"],
  },
  { label: "Infrastructure", items: ["Docker", "Kafka", "Terraform", "AWS", "Firebase"] },
];
