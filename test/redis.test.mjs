// The Redis backend against a small stand-in for Upstash's REST pipeline API, so its commands are checked offline.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

const data = new Map(), ttl = new Map();
const fake = createServer(async (req, res) => {
  if (req.headers.authorization !== "Bearer test-token") return res.writeHead(401).end();
  let body = ""; for await (const c of req) body += c;
  const out = JSON.parse(body).map(([cmd, key, ...a]) => {
    switch (cmd) {
      case "GET": return { result: data.has(key) ? data.get(key) : null };
      case "SET": {
        if (a.includes("NX") && data.has(key)) return { result: null };
        data.set(key, a[0]); const ex = a.indexOf("EX"); if (ex > -1) ttl.set(key, Number(a[ex + 1]));
        return { result: "OK" };
      }
      case "MGET": return { result: [key, ...a].map(k => data.get(k) ?? null) };
      case "INCRBY": case "INCRBYFLOAT": { const v = Number(data.get(key) || 0) + Number(a[0]); data.set(key, String(v)); return { result: cmd === "INCRBY" ? v : String(v) }; }
      case "EXPIRE": if (!ttl.has(key)) ttl.set(key, Number(a[0])); return { result: 1 };
      case "RPUSH": { const l = JSON.parse(data.get(key) || "[]"); l.push(...a); data.set(key, JSON.stringify(l)); return { result: l.length }; }
      case "LRANGE": return { result: JSON.parse(data.get(key) || "[]") };
      case "LREM": { const l = JSON.parse(data.get(key) || "[]").filter(x => x !== a[1]); data.set(key, JSON.stringify(l)); return { result: 1 }; }
      case "DEL": return { result: data.delete(key) ? 1 : 0 };
      default: return { error: `unknown command ${cmd}` };
    }
  });
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(out));
});

let kv, store;
before(async () => {
  await new Promise(r => fake.listen(0, "127.0.0.1", r));
  Object.assign(process.env, { KV_REST_API_URL: `http://127.0.0.1:${fake.address().port}`, KV_REST_API_TOKEN: "test-token", MOCK: "" });
  kv = await import("../src/kv.mjs");
  store = await import("../src/store.mjs");
});
after(() => fake.close());

const round = (id, t) => ({ id, source: "cli", started_at: t, finished_at: t, models: ["a/b"], questions: [
  { id: "q1", category: "crypto", prompt: "BTC?", entries: [{ model: "a/b", decision: "buy", guess_correct: false, final_correct: true, good_call: true, purchase: { ok: true, cost_usd: 0.01 }, telegraph_correct: true }] },
] });

test("rounds are saved, listed in order, read back and removed", async () => {
  assert.equal(kv.usingRedis(), true);
  await store.saveRound(round("aaaaaaa1", "2026-11-19T10:00:00Z"));
  await store.saveRound(round("aaaaaaa2", "2026-11-19T11:00:00Z"));
  assert.deepEqual((await store.recentRounds(5)).map(r => r.id), ["aaaaaaa2", "aaaaaaa1"]);
  assert.equal((await store.getRound("aaaaaaa1")).questions[0].prompt, "BTC?");
  assert.equal((await store.summary()).telegraph.purchases, 2);
  await store.removeRound("aaaaaaa1");
  assert.deepEqual((await store.recentRounds(5)).map(r => r.id), ["aaaaaaa2"]);
});

test("spend adds up per day, and counters expire", async () => {
  await store.recordSpend(0.01); await store.recordSpend(0.01);
  assert.equal(+(await store.spentToday()).toFixed(2), 0.02);
  assert.equal(await kv.incr("try:1.2.3.4", 1, 3600), 1);
  assert.equal(await kv.incr("try:1.2.3.4", 1, 3600), 2);
  assert.equal(ttl.get("try:1.2.3.4"), 3600);
});

test("the lock lets one holder in and frees on unlock", async () => {
  assert.equal(await kv.lock("busy", 300), true);
  assert.equal(await kv.lock("busy", 300), false);
  await kv.unlock("busy");
  assert.equal(await kv.lock("busy", 300), true);
});

test("a wrong token is reported clearly", async () => {
  process.env.KV_REST_API_TOKEN = "nope";
  const { config } = await import("../src/config.mjs");
  const saved = config.redisToken; config.redisToken = "nope";
  await assert.rejects(kv.getJSON("x"), /Redis answered 401/);
  config.redisToken = saved;
});
