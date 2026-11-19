// One round: every model sees every question, decides to answer or buy, and is graded against independent truth.
import { randomUUID } from "node:crypto";
import { config } from "./config.mjs";
import { fetchTruth, roundQuestions } from "./questions.mjs";
import { settle } from "./grade.mjs";
import { ask, mockAsk, MOCK_MODELS } from "./models.mjs";
import { makeBuyer, makeMockBuyer } from "./telegraph.mjs";
import { saveRound, spentToday, recordSpend } from "./store.mjs";

// Plausible made-up truths, for MOCK=1 runs with no network.
function mockTruth(q) {
  const base = { crypto: 100 + Math.random() * 1000, fx: 0.7 + Math.random(), weather: Math.round(Math.random() * 35), gas: 0.5 + Math.random() * 5 };
  return Promise.resolve({ value: q.category === "cve" ? [7.5 + Math.round(Math.random() * 20) / 10] : +base[q.category].toFixed(4), source: "mock" });
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// onEvent, if given, hears each step as it happens: every decision, every purchase, the truth, then the graded question.
export async function runQuestion(q, { models, buyer, mock, log = () => {}, onEvent = () => {} }) {
  const now = new Date();
  // In mock mode the fake models need the truth up front; for real runs it is fetched after they commit.
  const early = mock ? await mockTruth(q) : null;
  const decisions = await pool(models, 8, async model => {
    try {
      const d = { model, ...(mock ? await mockAsk(model, q, early.value) : await ask(model, q, { now })) };
      onEvent({ type: "decision", question: q.id, ...d });
      return d;
    } catch (e) {
      onEvent({ type: "decision", question: q.id, model, error: e.message });
      return { model, error: e.message };
    }
  });

  // Purchases run a few at a time; each one is a separate, paid Telegraph request with its own receipt.
  await pool(decisions.filter(d => !d.error && d.decision === "buy"), 4, async d => {
    if (await spentToday() >= config.dailyBudgetUsd) {
      d.purchase = { ok: false, error: `daily Telegraph budget of $${config.dailyBudgetUsd} reached` };
      return;
    }
    d.purchase = await buyer.buy(q.intent, q.params, q.field, q, early);
    if (d.purchase.ok && !mock) await recordSpend(d.purchase.cost_usd || 0);
    onEvent({ type: "purchase", question: q.id, model: d.model, purchase: d.purchase });
    log(`  ${d.model} bought ${q.intent}: ${d.purchase.ok ? d.purchase.value : "failed, " + d.purchase.error}`);
  });

  let truth;
  try {
    truth = early || await fetchTruth(q);
  } catch (e) {
    const voided = { ...q, asked_at: now.toISOString(), void: true, void_reason: e.message, entries: decisions };
    onEvent({ type: "graded", question: voided });
    return voided;
  }
  onEvent({ type: "truth", question: q.id, truth: truth.value, source: truth.source });
  const done = {
    ...q, asked_at: now.toISOString(), truth: truth.value, truth_source: truth.source,
    entries: decisions.map(d => d.error ? d : settle(d, truth.value, q.tolerance)),
  };
  onEvent({ type: "graded", question: done });
  return done;
}

export async function runRound({ questions, models = config.models, mock = config.mock, source = "scheduled", log = console.log, onEvent } = {}) {
  if (!mock && !config.openrouterKey) throw new Error("OPENROUTER_API_KEY is not set");
  if (mock) models = MOCK_MODELS;
  const buyer = mock ? makeMockBuyer() : makeBuyer();
  questions = questions || await roundQuestions(config.questionsPerRound);
  const round = { id: randomUUID().slice(0, 8), source, mock: !!mock, started_at: new Date().toISOString(), models, payer: buyer.address, network: buyer.network, questions: [] };
  log(`Round ${round.id}: ${questions.length} questions x ${models.length} models`);
  for (const q of questions) {
    log(`- ${q.prompt}`);
    const done = await runQuestion(q, { models, buyer, mock, log, onEvent });
    if (done.void) log(`  void: ${done.void_reason}`);
    else log(`  truth ${JSON.stringify(done.truth)} (${done.truth_source}); ` +
      done.entries.map(e => e.error ? `${short(e.model)} error` : `${short(e.model)} ${e.decision}${e.final_correct ? "✓" : e.final_correct === false ? "✗" : "-"}`).join(", "));
    round.questions.push(done);
  }
  round.finished_at = new Date().toISOString();
  await saveRound(round);
  return round;
}

const short = m => m.split("/").pop();
