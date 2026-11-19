// Advice and savings from graded history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advise, savings } from "../src/advice.mjs";

// A model that always knows CVEs and never knows prices; Telegraph is always right. At $0.25 a mistake against $0.01
// a purchase, trusting a model only pays off once its record is long and clean, hence 30 rounds.
const q = (round, category, knew, decision) => ({ category, entries: [
  { model: "a/knower", guess_correct: knew, decision, telegraph_correct: decision === "buy" ? true : null, purchase: decision === "buy" ? { ok: true } : undefined },
] });
const rounds = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, questions: [q(i, "cve", true, "buy"), q(i, "crypto", false, "answer")] }));

test("advises answering where the model is reliable and buying where it isn't", () => {
  const cve = advise(rounds, { model: "a/knower", topic: "cve" });
  assert.equal(cve.advice, "answer");
  assert.equal(cve.samples, 30);
  const crypto = advise(rounds, { model: "a/knower", topic: "crypto" });
  assert.equal(crypto.advice, "buy");
  assert.ok(crypto.expected_cost_usd.buy < crypto.expected_cost_usd.answer);
});

test("falls back to all models when it has no record for this one", () => {
  const r = advise(rounds, { model: "z/new", topic: "crypto" });
  assert.equal(r.samples, 0);
  assert.match(r.based_on, /all models/);
});

test("savings: following the advice beats both trusting and always buying here", () => {
  const s = savings(rounds);
  const cost = id => s.strategies.find(x => x.id === id).cost_per_100;
  assert.equal(s.decisions, 60);
  assert.ok(cost("confidant") < cost("never"));
  assert.ok(cost("confidant") < cost("always"));
  assert.ok(cost("oracle") <= cost("confidant"));
  assert.ok(s.headline.vs_never_pct > 0);
});
