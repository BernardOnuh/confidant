// What each API route does, independent of the web framework. Every function returns [status, body].
import { config } from "./config.mjs";
import { CATEGORIES, CVE_RX, makeQuestion } from "./questions.mjs";
import { runRound } from "./round.mjs";
import { getRound, recentRounds, summary } from "./store.mjs";
import { MOCK_MODELS } from "./models.mjs";
import { incr, lock, unlock, usingRedis } from "./kv.mjs";

const models = () => (config.mock ? MOCK_MODELS : config.models);

export const health = async () => [200, { ok: true, models: models(), store: usingRedis() ? "redis" : "files" }];

export const getSummary = async () => [200, await summary()];

export const options = async () => [200, {
  categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { label: c.label, subjects: c.subjects() }])),
  models: models(),
  try_per_hour: config.tryPerHour,
  mistake_cost_usd: config.mistakeCostUsd,
}];

export const listRounds = async limit => [200, await recentRounds(Math.min(50, Number(limit) || 20))];

export async function oneRound(id) {
  if (!/^[a-f0-9]{8}$/.test(id || "")) return [404, { error: "no such round" }];
  const r = await getRound(id);
  return r ? [200, r] : [404, { error: "no such round" }];
}

// A visitor's question: one question, every model, graded on the spot.
// One at a time across all visitors, and a few per visitor per hour (no limit when running on a laptop).
export async function tryQuestion(body, ip) {
  const c = CATEGORIES[body?.category];
  const subject = String(body?.subject || "").trim();
  const ok = c && (body.category === "cve" ? CVE_RX.test(subject.toUpperCase()) : c.subjects().includes(subject));
  if (!ok) return [400, { error: "pick a category and one of its subjects (or a CVE id like CVE-2024-3094)" }];
  if (!(await lock("busy", 300))) return [429, { error: "the models are busy with another question; try again in a minute" }];
  try {
    if (usingRedis() && (await incr(`try:${ip}`, 1, 3600)) > config.tryPerHour) {
      return [429, { error: `${config.tryPerHour} questions an hour per visitor` }];
    }
    const q = makeQuestion(body.category, body.category === "cve" ? subject.toUpperCase() : subject);
    return [200, await runRound({ questions: [q], source: "visitor", log: () => {} })];
  } finally {
    await unlock("busy");
  }
}
