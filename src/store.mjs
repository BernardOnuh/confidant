// Rounds, the leaderboard and the daily Telegraph spend. On a laptop rounds are JSON files under data/rounds;
// with Redis configured (Vercel) each round is a key and a list keeps their order.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.mjs";
import { leaderboard } from "./grade.mjs";
import * as kv from "./kv.mjs";

const roundsDir = () => join(config.dataDir, "rounds");
const today = () => new Date().toISOString().slice(0, 10);

// Rounds are read often and written rarely, so each server instance keeps them for a short while.
let cache = null, cachedAt = 0;
const FRESH_MS = 20_000;

async function loadRounds() {
  if (!kv.usingRedis()) {
    mkdirSync(roundsDir(), { recursive: true });
    return readdirSync(roundsDir()).filter(f => f.endsWith(".json")).sort()
      .map(f => { try { return JSON.parse(readFileSync(join(roundsDir(), f), "utf8")); } catch { return null; } })
      .filter(Boolean);
  }
  const ids = await kv.listAll("rounds");
  return (await kv.getMany(ids.map(id => `round:${id}`))).filter(Boolean);
}

export async function allRounds() {
  if (!cache || Date.now() - cachedAt > FRESH_MS) { cache = await loadRounds(); cachedAt = Date.now(); }
  return cache;
}

export async function saveRound(round) {
  if (kv.usingRedis()) {
    await kv.setJSON(`round:${round.id}`, round);
    await kv.listPush("rounds", round.id);
  } else {
    mkdirSync(roundsDir(), { recursive: true });
    writeFileSync(join(roundsDir(), `${round.started_at.replace(/[:.]/g, "-")}_${round.id}.json`), JSON.stringify(round, null, 1));
  }
  if (cache) cache.push(round);
}

export async function removeRound(id) {
  if (!kv.usingRedis()) throw new Error("removing rounds is only for the Redis store; delete the file under data/rounds instead");
  await kv.listRemove("rounds", id);
  await kv.del(`round:${id}`);
  cache = null;
}

export async function getRound(id) {
  if (kv.usingRedis()) return kv.getJSON(`round:${id}`);
  return (await allRounds()).find(r => r.id === id) || null;
}

const visible = rounds => rounds.filter(r => !r.mock || config.mock);

export function entriesOf(rounds) {
  return rounds.flatMap(r => r.questions.filter(q => !q.void).flatMap(q => q.entries.map(e => ({ ...e, category: q.category }))));
}

export async function summary() {
  const rounds = visible(await allRounds());
  const entries = entriesOf(rounds);
  const buys = entries.filter(e => e.purchase?.ok);
  const byCategory = {};
  for (const e of entries) {
    const c = byCategory[e.category] ||= { questions: 0, knew: 0, bought: 0 };
    c.questions++; c.knew += e.guess_correct ? 1 : 0; c.bought += e.decision === "buy" ? 1 : 0;
  }
  return {
    rounds: rounds.length,
    questions: rounds.reduce((n, r) => n + r.questions.filter(q => !q.void).length, 0),
    decisions: entries.length,
    leaderboard: leaderboard(entries, config.mistakeCostUsd),
    telegraph: {
      purchases: buys.length,
      spent_usd: buys.reduce((s, e) => s + (e.purchase.cost_usd || 0), 0),
      correct: buys.filter(e => e.telegraph_correct).length,
    },
    by_category: byCategory,
    mistake_cost_usd: config.mistakeCostUsd,
    updated_at: rounds.at(-1)?.finished_at || null,
  };
}

// The list view: one line per round, newest first.
export function roundSummary(r) {
  const qs = r.questions.filter(q => !q.void);
  const entries = qs.flatMap(q => q.entries.filter(e => !e.error));
  return { id: r.id, source: r.source, started_at: r.started_at, finished_at: r.finished_at, models: r.models.length,
    questions: qs.length, prompts: qs.map(q => q.prompt),
    decisions: entries.length, good_calls: entries.filter(e => e.good_call).length,
    buys: entries.filter(e => e.decision === "buy").length, overconfident: entries.filter(e => e.overconfident).length };
}

export async function recentRounds(limit = 20) {
  return visible(await allRounds()).slice(-limit).reverse().map(roundSummary);
}

// ----- daily cap on Telegraph purchases -----
export async function spentToday() {
  if (kv.usingRedis()) return kv.getNumber(`spend:${today()}`);
  return (await kv.getJSON("spend"))?.[today()] || 0;
}

export async function recordSpend(usd) {
  if (kv.usingRedis()) return kv.incr(`spend:${today()}`, usd, 3 * 86400);
  const s = (await kv.getJSON("spend")) || {};
  s[today()] = (s[today()] || 0) + usd;
  await kv.setJSON("spend", s);
}
