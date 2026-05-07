import express from "express";
import path from "path";

const app = express();

const port = Number(process.env.PORT ?? 3001);
const marketServiceUrl = process.env.MARKET_SERVICE_URL ?? "http://localhost:3000";

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/config.js", (req, res) => {
  res.type("application/javascript").send(
    `window.__CONFIG__ = ${JSON.stringify({ marketServiceUrl })};\n`
  );
});

const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

app.listen(port, () => {
  console.log(`web-ui listening on http://localhost:${port}`);
});

