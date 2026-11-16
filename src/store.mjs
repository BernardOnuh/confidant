// Rounds are JSON files under data/rounds; the leaderboard is recomputed from them.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.mjs";
import { leaderboard } from "./grade.mjs";

const roundsDir = () => join(config.dataDir, "rounds");
const spendPath = () => join(config.dataDir, "spend.json");
const today = () => new Date().toISOString().slice(0, 10);

let cache = null;

export function allRounds() {
  if (cache) return cache;
  mkdirSync(roundsDir(), { recursive: true });
  cache = readdirSync(roundsDir()).filter(f => f.endsWith(".json")).sort()
    .map(f => { try { return JSON.parse(readFileSync(join(roundsDir(), f), "utf8")); } catch { return null; } })
    .filter(Boolean);
  return cache;
}

export function saveRound(round) {
  mkdirSync(roundsDir(), { recursive: true });
  writeFileSync(join(roundsDir(), `${round.started_at.replace(/[:.]/g, "-")}_${round.id}.json`), JSON.stringify(round, null, 1));
  allRounds().push(round);
}

export function getRound(id) {
  return allRounds().find(r => r.id === id) || null;
}

export function entriesOf(rounds) {
  return rounds.flatMap(r => r.questions.filter(q => !q.void).flatMap(q => q.entries.map(e => ({ ...e, category: q.category }))));
}

export function summary() {
  const rounds = allRounds().filter(r => !r.mock || config.mock);
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

// ----- daily spend cap on Telegraph purchases -----
function readSpend() { try { return JSON.parse(readFileSync(spendPath(), "utf8")); } catch { return {}; } }

export function spentToday() { return readSpend()[today()] || 0; }

export function recordSpend(usd) {
  const s = readSpend();
  s[today()] = (s[today()] || 0) + usd;
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(spendPath(), JSON.stringify(s));
}

