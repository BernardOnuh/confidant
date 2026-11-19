// What each API route does, independent of the web framework. Every function returns [status, body].
import { config } from "./config.mjs";
import { CATEGORIES, CVE_RX, makeQuestion } from "./questions.mjs";
import { runRound } from "./round.mjs";
import { allRounds, getRound, recentRounds, summary } from "./store.mjs";
import { MOCK_MODELS } from "./models.mjs";
import { incr, lock, unlock, usingRedis } from "./kv.mjs";
import { advise, savings } from "./advice.mjs";

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

// A visitor's question: one question, every model, graded on the spot. One at a time across all visitors,
// and a few per visitor per hour (no limit when running on a laptop with files).
// Returns { error: [status, body] } or { stream }: newline-delimited JSON events as each model answers and buys,
// then the truth, then { type: "done", round }.
export async function startTry(body, ip) {
  const c = CATEGORIES[body?.category];
  const subject = String(body?.subject || "").trim();
  const ok = c && (body.category === "cve" ? CVE_RX.test(subject.toUpperCase()) : c.subjects().includes(subject));
  if (!ok) return { error: [400, { error: "pick a category and one of its subjects (or a CVE id like CVE-2024-3094)" }] };
  if (!(await lock("busy", 300))) return { error: [429, { error: "the models are busy with another question; try again in a minute" }] };
  if (usingRedis() && (await incr(`try:${ip}`, 1, 3600)) > config.tryPerHour) {
    await unlock("busy");
    return { error: [429, { error: `${config.tryPerHour} questions an hour per visitor` }] };
  }
  const q = makeQuestion(body.category, body.category === "cve" ? subject.toUpperCase() : subject);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = ev => ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      send({ type: "start", question: q, models: models() });
      try {
        send({ type: "done", round: await runRound({ questions: [q], source: "visitor", log: () => {}, onEvent: send }) });
      } catch (e) {
        send({ type: "error", error: e.message });
      } finally {
        await unlock("busy");
        ctrl.close();
      }
    },
  });
  return { stream };
}

// The same, waiting for the whole result: [status, finished round].
export async function tryQuestion(body, ip) {
  const r = await startTry(body, ip);
  if (r.error) return r.error;
  let round = null, error = null;
  for (const line of (await new Response(r.stream).text()).split("\n").filter(Boolean)) {
    const ev = JSON.parse(line);
    if (ev.type === "done") round = ev.round;
    if (ev.type === "error") error = ev.error;
  }
  return round ? [200, round] : [500, { error }];
}

// What the front page shows off: real decisions to replay, and the latest Telegraph receipts.
export async function showcase() {
  const rounds = (await allRounds()).filter(r => !r.mock || config.mock).slice(-12).reverse();
  const items = [];
  const receipts = [];
  for (const r of rounds) {
    for (const q of r.questions) {
      if (q.void) continue;
      for (const e of q.entries) {
        if (e.error) continue;
        const verdict = e.overconfident ? "overconfident" : e.wasted_buy ? "wasted" : e.voided ? "failed" : e.decision === "buy" ? "bought" : "knew";
        items.push({ round: r.id, at: q.asked_at, prompt: q.prompt, unit: q.unit, truth: q.truth, truth_source: q.truth_source,
          model: e.model, guess: e.guess, confidence: e.confidence, decision: e.decision, why: e.why,
          bought: e.purchase?.ok ? e.purchase.value : null, receipt: e.purchase?.signal_url || null, verdict });
        if (e.purchase?.ok && receipts.length < 8) {
          receipts.push({ round: r.id, at: q.asked_at, model: e.model, intent: q.intent, prompt: q.prompt, unit: q.unit,
            value: e.purchase.value, cost_usd: e.purchase.cost_usd, miner: e.purchase.miner_name || e.purchase.miner_id || null,
            signal_url: e.purchase.signal_url, correct: e.telegraph_correct, ms: e.purchase.ms });
        }
      }
    }
  }
  // A varied replay: alternate the outcomes so the first few cards show each kind of call.
  const byKind = Object.groupBy(items, i => i.verdict);
  const order = ["overconfident", "bought", "knew", "wasted"];
  const replay = [];
  for (let i = 0; replay.length < 14 && i < 14; i++) for (const k of order) if (byKind[k]?.[i] && replay.length < 14) replay.push(byKind[k][i]);
  return [200, { replay, receipts }];
}

const visibleRounds = async () => (await allRounds()).filter(r => !r.mock || config.mock);

// GET /api/advice?model=<openrouter id>&topic=<crypto|fx|weather|gas|cve>: should this model answer, or buy?
export async function advice(query) {
  const model = String(query.get("model") || "").trim(), topic = String(query.get("topic") || "").trim();
  if (!/^[\w.-]+\/[\w.:-]+$/.test(model) || model.length > 100) return [400, { error: "model must be an OpenRouter id such as anthropic/claude-sonnet-5.5" }];
  if (!CATEGORIES[topic]) return [400, { error: `topic must be one of ${Object.keys(CATEGORIES).join(", ")}` }];
  const rounds = await visibleRounds();
  return [200, { ...advise(rounds, { model, topic, mistake: config.mistakeCostUsd }), rounds: rounds.length, updated_at: rounds.at(-1)?.finished_at || null }];
}

// The same advice for people trying it on the website: free, a few dozen an hour.
export async function advicePreview(query, ip) {
  if ((await incr(`preview:${ip}`, 1, 3600)) > config.previewPerHour) return [429, { error: "preview limit reached; agents can call the paid endpoint" }];
  return advice(query);
}

export async function getSavings() {
  return [200, savings(await visibleRounds(), config.mistakeCostUsd)];
}

export const adviceTerms = () => ({ price: config.advicePrice, network: config.adviceNetwork, path: "/api/advice" });
