// Key-value storage with two backends: Upstash Redis over its REST API (on Vercel), or JSON files under
// data/ (on a laptop). Both offer the same few operations, so the rest of the code doesn't care which.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.mjs";

export const usingRedis = () => !!(config.redisUrl && config.redisToken);

async function redis(commands) {
  const res = await fetch(`${config.redisUrl}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(15000),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(out)) throw new Error(`Redis answered ${res.status}${out?.error ? ": " + out.error : ""}`);
  return out.map(r => { if (r.error) throw new Error("Redis: " + r.error); return r.result; });
}
const one = async (...cmd) => (await redis([cmd]))[0];

// ----- files: one JSON file per key; lists are folders of numbered files -----
const file = key => join(config.dataDir, key.replace(/[^\w.-]/g, "_") + ".json");
const readFile = key => { try { return JSON.parse(readFileSync(file(key), "utf8")); } catch { return null; } };
const writeFile = (key, v) => { mkdirSync(config.dataDir, { recursive: true }); writeFileSync(file(key), JSON.stringify(v)); };
const memo = new Map(); // locks and counters in file mode live in memory, like the old single server

export async function getJSON(key) {
  if (!usingRedis()) return readFile(key);
  const v = await one("GET", key);
  return v === null ? null : JSON.parse(v);
}

export async function setJSON(key, value, ttlSeconds) {
  if (!usingRedis()) return writeFile(key, value);
  await one(...["SET", key, JSON.stringify(value)], ...(ttlSeconds ? ["EX", String(ttlSeconds)] : []));
}

// Many keys at once, in chunks so no single reply gets large.
export async function getMany(keys) {
  if (!usingRedis()) return keys.map(readFile);
  const out = [];
  for (let i = 0; i < keys.length; i += 20) {
    const vals = await one("MGET", ...keys.slice(i, i + 20));
    out.push(...vals.map(v => (v === null ? null : JSON.parse(v))));
  }
  return out;
}

// Adds to a number and returns the new total. ttl sets when the counter expires (first write only).
export async function incr(key, by = 1, ttlSeconds) {
  if (!usingRedis()) {
    const now = Date.now(), cur = memo.get(key);
    const live = cur && (!cur.until || cur.until > now) ? cur : { n: 0, until: ttlSeconds ? now + ttlSeconds * 1000 : 0 };
    live.n += by; memo.set(key, live);
    return live.n;
  }
  const cmds = [Number.isInteger(by) ? ["INCRBY", key, String(by)] : ["INCRBYFLOAT", key, String(by)]];
  if (ttlSeconds) cmds.push(["EXPIRE", key, String(ttlSeconds), "NX"]);
  return Number((await redis(cmds))[0]);
}

export async function getNumber(key) {
  if (!usingRedis()) { const c = memo.get(key); return c && (!c.until || c.until > Date.now()) ? c.n : 0; }
  return Number((await one("GET", key)) || 0);
}

// A lock that frees itself after ttl seconds, so a crashed run can't hold it forever.
export async function lock(key, ttlSeconds) {
  if (!usingRedis()) {
    const c = memo.get(key);
    if (c && c.until > Date.now()) return false;
    memo.set(key, { n: 1, until: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  return (await one("SET", key, "1", "NX", "EX", String(ttlSeconds))) === "OK";
}

export async function unlock(key) {
  if (!usingRedis()) return void memo.delete(key);
  await one("DEL", key);
}

// ----- ordered lists of ids (the rounds) -----
export async function listPush(key, id) {
  if (!usingRedis()) { const l = readFile(key) || []; l.push(id); return writeFile(key, l); }
  await one("RPUSH", key, id);
}

export async function listAll(key) {
  if (!usingRedis()) return readFile(key) || [];
  return one("LRANGE", key, "0", "-1");
}

export async function listRemove(key, id) {
  if (!usingRedis()) return writeFile(key, (readFile(key) || []).filter(x => x !== id));
  await one("LREM", key, "0", id);
}

export async function del(key) {
  if (!usingRedis()) { try { unlinkSync(file(key)); } catch {} return; }
  await one("DEL", key);
}

