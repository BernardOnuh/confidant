#!/usr/bin/env node
// The Confidant site: the leaderboard, every round's replay, and a box to put your own question to the models.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config, ROOT } from "./config.mjs";
import { CATEGORIES, CVE_RX, makeQuestion } from "./questions.mjs";
import { runRound } from "./round.mjs";
import { allRounds, getRound, summary } from "./store.mjs";
import { MOCK_MODELS } from "./models.mjs";

const page = () => readFileSync(join(ROOT, "web", "index.html"));
const hits = new Map();
let busy = false;

// Requests from this machine or the home network (the owner testing on a laptop or phone, not through a proxy) are not limited.
const PRIVATE = /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^::1$/;
const isLocal = req => !req.headers["x-forwarded-for"] && PRIVATE.test(req.socket.remoteAddress || "");

function allow(ip, limit = config.tryPerHour, windowMs = 3600e3) {
  const now = Date.now();
  const q = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (q.length >= limit) return false;
  q.push(now); hits.set(ip, q);
  return true;
}

function roundSummary(r) {
  const qs = r.questions.filter(q => !q.void);
  const entries = qs.flatMap(q => q.entries.filter(e => !e.error));
  return { id: r.id, source: r.source, started_at: r.started_at, finished_at: r.finished_at, models: r.models.length,
    questions: qs.length, prompts: qs.map(q => q.prompt),
    decisions: entries.length, good_calls: entries.filter(e => e.good_call).length,
    buys: entries.filter(e => e.decision === "buy").length, overconfident: entries.filter(e => e.overconfident).length };
}

function send(res, status, body, type = "application/json") {
  const data = Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(data);
}

async function readBody(req) {
  let n = 0; const parts = [];
  for await (const c of req) { n += c.length; if (n > 4000) throw new Error("body too large"); parts.push(c); }
  return JSON.parse(Buffer.concat(parts).toString() || "{}");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return send(res, 200, page(), "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true, models: config.mock ? MOCK_MODELS : config.models, busy });
    if (req.method === "GET" && url.pathname === "/api/summary") return send(res, 200, summary());
    if (req.method === "GET" && url.pathname === "/api/options") {
      return send(res, 200, { categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { label: c.label, subjects: c.subjects() }])),
        models: config.mock ? MOCK_MODELS : config.models });
    }
    if (req.method === "GET" && url.pathname === "/api/rounds") {
      const limit = Math.min(50, Number(url.searchParams.get("limit")) || 20);
      return send(res, 200, allRounds().filter(r => !r.mock || config.mock).slice(-limit).reverse().map(roundSummary));
    }
    const m = url.pathname.match(/^\/api\/rounds\/([a-f0-9]{8})$/);
    if (req.method === "GET" && m) {
      const r = getRound(m[1]);
      return r ? send(res, 200, r) : send(res, 404, { error: "no such round" });
    }
    if (req.method === "POST" && url.pathname === "/api/try") {
      const body = await readBody(req);
      const c = CATEGORIES[body.category];
      const subject = String(body.subject || "").trim();
      const ok = c && (body.category === "cve" ? CVE_RX.test(subject.toUpperCase()) : c.subjects().includes(subject));
      if (!ok) return send(res, 400, { error: "pick a category and one of its subjects (or a CVE id like CVE-2024-3094)" });
      if (busy) return send(res, 429, { error: "the models are busy with another question; try again in a minute" });
      if (!isLocal(req) && !allow(ip)) return send(res, 429, { error: `${config.tryPerHour} questions an hour per visitor` });
      busy = true;
      try {
        const q = makeQuestion(body.category, body.category === "cve" ? subject.toUpperCase() : subject);
        const r = await runRound({ questions: [q], source: "visitor", log: () => {} });
        return send(res, 200, r);
      } finally { busy = false; }
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Confidant on http://${config.host}:${config.port}  (${config.mock ? "MOCK mode" : config.models.length + " models"})`);
});

if (config.roundEveryMin > 0) {
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runRound({ source: "scheduled" }); } catch (e) { console.error("round failed:", e.message); } finally { busy = false; }
  };
  setInterval(tick, config.roundEveryMin * 60e3);
}
