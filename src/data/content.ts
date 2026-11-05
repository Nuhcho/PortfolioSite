// Copy uses the supplied project and resume facts. Missing employment dates,
// job titles, repository URLs and evaluation conditions are not inferred.
export const profile = {
  name: "Nicolas Villegas-Kirchman",
  role: "Software engineering & applied ML",
  introduction: "I build ML applications, data pipelines, and cloud infrastructure.",
  about: "I’m a Computer Science & Engineering student at Santa Clara University, focused on applied machine learning and backend systems.",
  approach: "I’ve built image-classification applications, led the backend for a cloud infrastructure manager, and worked on production data pipelines. My work spans model inference, API development, document retrieval, and cloud deployment.",
  projectsIntro: "A selection of my machine learning applications, backend systems, and developer tools.",
  experienceIntro: "Work on real-time network data, document retrieval, and connected hardware.",
  skillsIntro: "The languages and tools I’ve used across my projects and engineering work.",
  contactIntro: "Have a project in mind or an opportunity in software engineering or applied ML? I’d be happy to connect.",
};

export type Entry = {
  name: string;
  focus: string;
  summary: string;
  metric: string;
  detail: string;
  technologies: string[];
  category: "ml" | "systems";
  code: string;
  featured?: boolean;
};

// Focus describes the work without assigning an unprovided job title or date.
export const experience: Entry[] = [
  {
    name: "Lumen Technologies",
    focus: "Real-time threat scoring",
    summary: "I built a distributed pipeline that runs ML models against millions of network records a day.",
    metric: "Millions of records processed daily",
    detail: "Deployed models in Docker containers and used Kafka and PySpark to process live network traffic. Separate IPv4 and IPv6 pipelines retrain nightly on the previous day’s traffic. The IPv4 pipeline updates an existing threat score; the IPv6 pipeline adds a new one.",
    technologies: ["Python", "Kafka", "PySpark", "Docker"],
    category: "systems",
    code: "SYS",
  },
  {
    name: "Kodely",
    focus: "Document processing & retrieval",
    summary: "I built a textbook extraction and retrieval system for semantic search and question answering.",
    metric: "10,000+ textbook pages indexed",
    detail: "Used Docling to parse textbook documents and pgvector to store their embeddings. The retrieval-augmented generation pipeline finds relevant text chunks and uses them to generate an answer.",
    technologies: ["Docling", "pgvector", "RAG"],
    category: "systems",
    code: "SYS",
  },
  {
    name: "Actiontec",
    focus: "WiFi & mesh networking",
    summary: "I worked on mesh networking enhancements for WiFi 7 and WiFi 6E hardware.",
    metric: "40% improvement in connectivity",
    detail: "Focused on WiFi 7 and WiFi 6E optimization, improving connectivity through mesh networking enhancements.",
    technologies: ["WiFi 7", "WiFi 6E", "Mesh networking"],
    category: "systems",
    code: "SYS",
  },
];

export const projects: Entry[] = [
  {
    name: "Cogniscan",
    focus: "MRI image classification",
    summary: "A full-stack MRI analysis application built around an Alzheimer’s image classification model.",
    metric: "97.8% accuracy in project evaluation",
    detail: "Connected a PyTorch and OpenCV image analysis pipeline to a Django REST API, with a Next.js and Tailwind frontend. The project brings image processing, model inference, and an application interface into one system.",
    technologies: ["PyTorch", "OpenCV", "Django", "Next.js", "Tailwind CSS"],
    category: "ml",
    code: "ML",
    featured: true,
  },
  {
    name: "OmniScanner",
    focus: "ML screening prototype",
    summary: "A cancer-screening prototype created for the ACM × Intel hackathon.",
    metric: "2nd place · ACM × Intel hackathon",
    detail: "Built an ML screening tool for the competition, where it placed second among the participating teams.",
    technologies: [],
    category: "ml",
    code: "ML",
    featured: true,
  },
  {
    name: "Gastronomy",
    focus: "Tissue image classification",
    summary: "A patch-based tissue classifier with a Django API and a ResNet50 image analysis pipeline.",
    metric: "96.8% accuracy in project evaluation",
    detail: "Built the classification pipeline with TensorFlow and ResNet50, alongside scikit-learn and XGBoost, and exposed it through a Django REST API.",
    technologies: ["TensorFlow", "ResNet50", "scikit-learn", "XGBoost", "Django"],
    category: "ml",
    code: "ML",
  },
  {
    name: "Distributed System Manager",
    focus: "Cloud infrastructure management",
    summary: "A team-built application for provisioning and monitoring cloud infrastructure. I led backend development.",
    metric: "Backend lead · Team project",
    detail: "Built the backend with FastAPI and PostgreSQL. Also contributed to the Next.js and React frontend and the Docker-based AWS EC2 deployment, provisioned with Terraform.",
    technologies: ["FastAPI", "PostgreSQL", "AWS EC2", "Terraform", "Docker", "Next.js"],
    category: "systems",
    code: "SYS",
  },
  {
    name: "ARMSE",
    focus: "Distributed systems",
    summary: "A cloud-distributed systems platform built on AWS infrastructure.",
    metric: "AWS-based platform",
    detail: "",
    technologies: ["AWS"],
    category: "systems",
    code: "SYS",
  },
  {
    name: "BroadbandNow Scraper",
    focus: "Web automation & data collection",
    summary: "A browser automation tool that collects broadband provider data and exports it to CSV.",
    metric: "6 provider categories",
    detail: "Used Selenium to collect provider data across 5G home internet, fiber, cable, fixed wireless, satellite, and DSL categories from BroadbandNow.",
    technologies: ["Selenium", "CSV"],
    category: "systems",
    code: "SYS",
  },
  {
    name: "USP Data Model Scraper",
    focus: "Specification parsing & data extraction",
    summary: "A tool that turns the Broadband Forum’s TR-181 USP device data model into structured CSV files.",
    metric: "Object & command hierarchy exported",
    detail: "Used Selenium to parse the specification and export its full object and command hierarchy for use as structured data.",
    technologies: ["Selenium", "TR-181", "CSV"],
    category: "systems",
    code: "SYS",
  },
];

export const contact = {
  email: "nicovk223405@gmail.com",
  linkedin: "https://www.linkedin.com/in/nuhchonvk/",
  linkedinLabel: "LinkedIn",
  github: "https://github.com/Nuhcho",
  githubLabel: "GitHub",
};

export const affiliation = {
  school: "Santa Clara University",
  degree: "B.E. Computer Science & Engineering",
  expected: "expected June 2027",
  gpa: "GPA 3.5",
  coursework: "computer architecture, algorithms, networking, machine learning, compilers, and circuits",
  recognition: "Hack For Humanity finalist · 2nd place, ACM × Intel hackathon",
};

export const skillGroups: { label: string; items: string[] }[] = [
  { label: "Languages", items: ["Python", "JavaScript", "TypeScript"] },
  { label: "Web & APIs", items: ["React", "Next.js", "Django", "FastAPI"] },
  { label: "Machine learning", items: ["PyTorch", "TensorFlow", "scikit-learn", "XGBoost", "OpenCV"] },
  { label: "Data & retrieval", items: ["PostgreSQL", "pgvector", "PySpark", "Docling", "Kafka"] },
  { label: "Cloud & infrastructure", items: ["Docker", "Terraform", "AWS", "Firebase"] },
];
