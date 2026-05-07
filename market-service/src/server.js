import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionsFilePath = path.join(__dirname, "..", "versions.json");

app.use(cors());
app.use(express.json());

let nextId = 3;
const products = [
  { id: 1, name: "Apple", price: 1.5 },
  { id: 2, name: "Orange", price: 1.25 }
];
let versions = loadVersions();

function loadVersions() {
  try {
    if (!fs.existsSync(versionsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(versionsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVersions() {
  fs.writeFileSync(versionsFilePath, JSON.stringify(versions, null, 2));
}

async function triggerDeployment(version) {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  // Keep this flow usable locally even when GitHub credentials are missing.
  if (!repo || !token) {
    return { mode: "local-simulated", dispatched: false };
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      event_type: "deploy",
      client_payload: { version }
    })
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`GitHub dispatch failed: ${res.status} ${message}`);
  }

  return { mode: "github-dispatch", dispatched: true };
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/products", (req, res) => {
  res.json({ items: products });
});

app.post("/products", (req, res) => {
  const { name, price } = req.body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }

  const item = { id: nextId++, name: name.trim(), price };
  products.push(item);

  return res.status(201).json({ item });
});

app.post("/version", (req, res) => {
  const version = String(req.body?.version ?? "").trim();
  if (!version) {
    return res.status(400).json({ error: "version is required" });
  }
  if (versions.some((v) => v.version === version)) {
    return res.status(409).json({ error: "version already exists" });
  }

  const entry = {
    version,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  versions.unshift(entry);
  saveVersions();

  return res.status(201).json({ item: entry });
});

app.get("/versions", (req, res) => {
  res.json({ items: versions });
});

app.post("/approve-version", async (req, res) => {
  const version = String(req.body?.version ?? "").trim();
  if (!version) {
    return res.status(400).json({ error: "version is required" });
  }

  const entry = versions.find((v) => v.version === version);
  if (!entry) {
    return res.status(404).json({ error: "version not found" });
  }
  if (entry.status === "approved") {
    return res.status(409).json({ error: "version already approved" });
  }

  entry.status = "approved";
  entry.approvedAt = new Date().toISOString();

  try {
    const deploy = await triggerDeployment(version);
    entry.deploy = deploy;
    saveVersions();
    return res.json({ item: entry });
  } catch (error) {
    entry.status = "approval_failed";
    entry.deployError = String(error);
    saveVersions();
    return res.status(500).json({ error: "approval saved but deployment trigger failed", details: String(error) });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  // Keep logs minimal for demo
  console.log(`market-service listening on http://localhost:${port}`);
});

