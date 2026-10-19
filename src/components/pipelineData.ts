export type PipelineNode = {
  id: string;
  label: string;
  sub: string;
  x: number;
  z: number;
  y?: number;
  tone: "stone" | "ml" | "systems";
};

export type PipelineEdge = [string, string];

export type PipelineConfig = {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  alertNodeId?: string;
  alertLabel?: string;
};

// Lumen: a shared ingestion stage forks into two parallel lanes (IPv4, IPv6),
// each retraining nightly then scoring live traffic against that model.
export const lumenPipeline: PipelineConfig = {
  nodes: [
    { id: "stream", label: "Record Stream", sub: "network events", x: 0, z: -6.2, tone: "stone" },
    { id: "kafka", label: "Kafka / PySpark", sub: "ingest + transform", x: 0, z: -3.6, tone: "stone" },
    { id: "trainTop", label: "Train Model", sub: "past-day data · ipv4", x: -3.5, z: -0.8, tone: "systems" },
    { id: "modelTop", label: "Model", sub: "scores live data", x: -3.5, z: 2, y: 0.35, tone: "ml" },
    { id: "scoreTop", label: "Update Score", sub: "ipv4", x: -3.5, z: 4.8, tone: "systems" },
    { id: "trainBottom", label: "Train Model", sub: "past-day data · ipv6", x: 3.5, z: -0.8, tone: "systems" },
    { id: "modelBottom", label: "Model", sub: "scores live data", x: 3.5, z: 2, y: 0.35, tone: "ml" },
    { id: "scoreBottom", label: "Add Score", sub: "ipv6", x: 3.5, z: 4.8, tone: "systems" },
  ],
  edges: [
    ["stream", "kafka"],
    ["kafka", "trainTop"],
    ["kafka", "trainBottom"],
    ["trainTop", "modelTop"],
    ["trainBottom", "modelBottom"],
    ["modelTop", "scoreTop"],
    ["modelBottom", "scoreBottom"],
  ],
  alertNodeId: "kafka",
  alertLabel: "millions of records / day",
};

// Kodely: a single linear RAG chain — parse, embed, store, retrieve, generate.
export const kodelyPipeline: PipelineConfig = {
  nodes: [
    { id: "pdfs", label: "Textbook PDFs", sub: "10,000+ pages", x: -1.6, z: -5.6, tone: "stone" },
    { id: "docling", label: "Docling", sub: "parse + extract", x: 1.6, z: -3.2, tone: "stone" },
    { id: "embed", label: "Embed", sub: "vectorize chunks", x: -1.6, z: -0.8, y: 0.35, tone: "ml" },
    { id: "pgvector", label: "pgvector", sub: "vector storage", x: 1.6, z: 1.6, tone: "systems" },
    { id: "retrieve", label: "Retrieve", sub: "relevant chunks", x: -1.6, z: 4, tone: "systems" },
    { id: "generate", label: "Generate Answer", sub: "RAG response", x: 1.6, z: 6.4, tone: "systems" },
  ],
  edges: [
    ["pdfs", "docling"],
    ["docling", "embed"],
    ["embed", "pgvector"],
    ["pgvector", "retrieve"],
    ["retrieve", "generate"],
  ],
};
