# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (React)

## Users

Primary visitors are people evaluating the site owner directly — recruiters, collaborators, or clients sizing up credibility and skill. They are not a purchase-intent audience; their job is assessment, not conversion.

## Product Purpose

A personal portfolio site presenting the owner's work, projects, and identity. It exists to help a visitor who is sizing someone up form a clear, credible judgment about their skill and body of work. Success means the visitor leaves with an accurate sense of what the owner has done and can do, and ideally takes a next step (contact, follow a link to real work, etc.).

## Positioning

Nicolas spans both applied AI/ML and software engineering — he doesn't just prototype models, he ships them into production infrastructure (containerized pipelines, distributed real-time processing, cloud platforms) and validates them with quantified outcomes. A neighboring "AI portfolio" template (built around demos or toy notebooks) or a generic "full-stack developer" template (built around CRUD apps) could not truthfully make either half of this claim.

## Operating Context

Public-facing, no login, no backend required by the brief so far. Read as a standalone site, not embedded in a larger product.

## Capabilities and Constraints

- Building fresh with Next.js (React); no existing scaffold beyond a placeholder `index.js`/`package.json`.
- No accessibility standard specified beyond general good practice, except the confirmed exception below for the neomorphism world.

## Brand Commitments

Owner's name: Nicolas Dean Villegas-Kirchman. No visual brand (logo, palette, voice) locked in beyond the visual direction chosen in shape (see the portfolio surface brief). Public contact surface is limited to email and social links — no phone number is to be published on the site.

## Evidence on Hand

Real resume content supplied by the owner (source: user-provided Google Doc resume summary):

- **Contact:** email (nicovk223405@gmail.com), LinkedIn (linkedin.com/in/nuhchonvk), GitHub (github.com/Nuhcho). Phone number exists on the source resume but is explicitly excluded from the public site.
- **Education:** Santa Clara University, B.E. Computer Science and Engineering, GPA 3.5, expected June 2027. Coursework: architecture, algorithms, networking, machine learning, compilers, circuits.
- **Recognition:** Hack For Humanity Finalist; ACM x Intel Hack Winner.
- **Experience:**
  - Lumen Technologies — built a distributed real-time threat scoring pipeline, deploying ML models into containerized Docker nodes; processed millions of network records daily using Kafka and PySpark.
  - Kodely — built an extraction system handling 10,000+ textbook pages with vector database storage for semantic search.
  - Actiontec — WiFi 7/6E optimization work, achieving a 40% improvement in connectivity through mesh networking enhancements.
- **Projects:**
  - ARMSE — cloud-distributed systems platform on AWS infrastructure.
  - Cogniscan — MRI analysis for Alzheimer's assessment, 97.8% accuracy.
  - OmniScanner — cancer screening tool, 2nd place at the ACM x Intel competition.
  - Gastronomy — tissue classification system, 96.8% accuracy.
- **Technical stack:** Python, JavaScript, TypeScript, React, Next.js, PyTorch, TensorFlow, PostgreSQL, Docker, Kafka, cloud platforms. (Extended below with GitHub-confirmed additions: Django, FastAPI, scikit-learn, XGBoost, OpenCV, Terraform, AWS, Firebase.)

Additional real evidence gathered directly from the owner's GitHub (github.com/Nuhcho profile repos, plus github.com/CSEN174-W2026/csen174-teampenne), per the owner's explicit instruction to refine Projects from these sources while leaving Experience untouched ("The company stuff i cant send per NDA"):

- **Cogniscan** (repo `Cogniscan`) — confirmed full-stack architecture: Django REST backend with CORS, Next.js + Tailwind + shadcn frontend, PyTorch + OpenCV vision pipeline, Pandas/NumPy/PyArrow. The README has no functional description or accuracy figure of its own; the 97.8% figure remains sourced from the original resume, not re-confirmed here — the two sources are additive, not conflicting.
- **Gastronomy** (repo `GastronomyBackend`, paired with `GastronomyFrontend`) — README's internal project name is "CancerCNN Backend" (differs from the resume/repo name "Gastronomy"; same project, confirmed by the owner's GitHub account and subject matter). Confirmed stack: Django REST API, TensorFlow (ResNet50) + scikit-learn + XGBoost, patch-based image classification (binary and multi-class), SQLite. The 96.8% accuracy figure remains sourced from the original resume.
- **Distributed System Manager** (repo `CSEN174-W2026/csen174-teampenne`, a CSEN 174 team project) — new project added to the site. Confirmed stack: FastAPI + PostgreSQL backend, Next.js/React frontend, Terraform-provisioned AWS EC2 infrastructure, Docker, Firebase. Owner confirmed his role directly: backend was "the big bulk" of his work, with additional contributions to the frontend and infrastructure — the site describes it as team-built and credits his backend lead, not sole authorship.
- **OmniScanner** — the owner's `ACMHack` repo (described on GitHub as "Intel-ACM-2025-Hackathon") corroborates this is the same ACM x Intel competition project from the resume; no additional stack detail could be retrieved from the repo.
- **ARMSE** — no matching public repo was found in this GitHub pass. Owner explicitly confirmed (2026-09-23) to keep it on the site as-is, unenriched, since it remains valid original resume evidence even though this pass couldn't independently corroborate it.
- **Senior-Design-Project** (repo, most recently updated) and **Prophecy** (a sports-prediction ML project named in the owner's GitHub bio as "currently developing") — both currently have no public content to cite (the repo is empty; no repo for Prophecy was found). Owner explicitly confirmed (2026-09-23) to leave both off the site for now rather than add a placeholder; revisit once either has real, citable substance.
- **BroadbandNow Scraper** (repo `BroadbandNow-WebScraper`) and **USP Data Model Scraper** (repo `USP-Data-Models`) — added 2026-09-24 per the owner's follow-up request to add more real projects. Both are real, functioning single-script Selenium scrapers from 2023 with no README; confirmed directly by reading the source: the first catalogs BroadbandNow provider listings across 5G/fiber/cable/fixed-wireless/satellite/DSL to CSV, the second parses the Broadband Forum's TR-181 USP device data model spec to structured CSV. Explicitly flagged to the owner as more modest in scope than the featured ML/systems work; owner confirmed (2026-09-24) to add both as compact secondary rows rather than skip or feature them.
- Other repos on the account (course lab assignments — Term-Project-COEN12, Lab-6-COEN12, Lab-5-COEN, Lab2Coen79, USB-Tethering-Fix; a "first attempt" Discord bot; a tutorial-style tinder-clone and its `Hackathon2024` wrapper; a high-school APCSA project; `CogniscanPrivate`, a private duplicate; `react-resume-template`, a fork) were reviewed and deliberately left off the site as below the portfolio's quality bar — not because they're unconfirmed, but as an editorial curation call, consistent with Product Principles below.
- **Lumen Technologies pipeline detail** (added 2026-09-29, first-hand from the owner directly, same evidentiary tier as the original resume interview): two parallel pipelines, one per IP version. Each retrains its own model nightly on the past day's traffic; live records are then scored against that model — the IPv4 pipeline updates an existing score, the IPv6 pipeline adds a new one. Visualized as an animated branching pipeline diagram (Figure 1) inside the entry's expanded detail.
- **Kodely pipeline detail** (added 2026-09-29, same first-hand evidentiary tier): a RAG (retrieval-augmented generation) pipeline — Docling parses and extracts the textbook corpus, embeddings are stored in pgvector, and queries retrieve relevant chunks to generate an answer. Visualized as a new animated pipeline diagram (Figure 2) inside the entry's expanded detail, mirroring Figure 1's treatment.

Nothing beyond this has been confirmed (no testimonials, press, or case studies exist) — future work must not fabricate any of those, and must not invent metrics or claims beyond what's listed above.

## Accessibility & Inclusion

Superseded. An earlier round confirmed "purist, accept the tradeoff" for the neomorphism world's contrast (see git/session history for that original exchange). The user later gave a detailed redesign brief explicitly demanding real accessibility rigor — "neumorphism frequently creates contrast problems, so pay special attention," "readable text contrast," "sufficient distinction between interactive and static surfaces" — which is treated as a deliberate, explicit reversal of the earlier purist choice, not an oversight to reconcile. Current standing rule: the neomorphism (Soft UI) world holds to normal WCAG AA expectations like every other visual world on this site. Text and accent colors were re-tuned darker (within the same hue families) specifically to clear 4.5:1 against the `#e0e5ec` base while keeping the dual-shadow extrusion material intact — depth comes from shadow, not from low-contrast color.

## Product Principles

- Every claim, project, and credential shown must be real; never fabricate work samples or testimonials to fill space.
- Let the work carry the argument — minimize friction between a visitor and evidence of skill.
- Build for incremental growth: structure the site so real content can be dropped in over time rather than requiring a rewrite.
- Favor clarity and credibility over persuasion tactics — the visitor is evaluating, not being sold to.
