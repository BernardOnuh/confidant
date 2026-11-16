import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrect, parseDecision, settle, leaderboard, toNumber, toleranceText } from "../src/grade.mjs";

test("toNumber reads numbers out of model strings", () => {
  assert.equal(toNumber("$97,412.50"), 97412.5);
  assert.equal(toNumber(" 7.5 "), 7.5);
  assert.equal(toNumber("-3 C"), -3);
  assert.equal(toNumber("unknown"), null);
  assert.equal(toNumber(NaN), null);
});

test("relative and absolute tolerances", () => {
  assert.equal(isCorrect(100.9, 100, { rel: 0.01 }), true);
  assert.equal(isCorrect(101.1, 100, { rel: 0.01 }), false);
  assert.equal(isCorrect(22, 24.4, { abs: 2.5 }), true);
  assert.equal(isCorrect(21.8, 24.4, { abs: 2.5 }), false);
  // gas: either bound is enough
  assert.equal(isCorrect(0.5, 0.25, { rel: 0.35, abs: 0.3 }), true);
});

test("CVSS accepts any of the listed versions", () => {
  assert.equal(isCorrect(9.8, [10, 9.8], { abs: 0.05 }), true);
  assert.equal(isCorrect(9.0, [10, 9.8], { abs: 0.05 }), false);
});

test("nothing is correct against a missing truth or answer", () => {
  assert.equal(isCorrect(null, 5, { abs: 1 }), false);
  assert.equal(isCorrect(5, null, { abs: 1 }), false);
});

test("parseDecision tolerates fences and chatter", () => {
  const d = parseDecision('Sure!\n```json\n{"guess": "97,000", "confidence": 0.2, "decision": "Buy", "why": "prices move"}\n```');
  assert.deepEqual(d, { guess: 97000, confidence: 0.2, decision: "buy", why: "prices move" });
  assert.equal(parseDecision("{not json} then {\"guess\": 3, \"decision\": \"answer\"}").guess, 3);
  assert.equal(parseDecision("no json here"), null);
  assert.equal(parseDecision('{"guess": 2, "confidence": 7, "decision": "answer"}').confidence, 1);
});

test("toleranceText", () => {
  assert.equal(toleranceText({ rel: 0.01 }, "US dollars"), "within 1%");
  assert.equal(toleranceText({ rel: 0.35, abs: 0.3 }, "gwei"), "within 35% or 0.3 gwei");
});

const tol = { rel: 0.01 };

test("settle: the four kinds of call", () => {
  const knewAndAnswered = settle({ model: "a", guess: 100, decision: "answer" }, 100, tol);
  assert.equal(knewAndAnswered.good_call, true);
  assert.equal(knewAndAnswered.final_correct, true);

  const overconfident = settle({ model: "a", guess: 80, decision: "answer" }, 100, tol);
  assert.equal(overconfident.good_call, false);
  assert.equal(overconfident.overconfident, true);
  assert.equal(overconfident.final_correct, false);

  const rightToBuy = settle({ model: "a", guess: 80, decision: "buy", purchase: { ok: true, value: 100.2, cost_usd: 0.01 } }, 100, tol);
  assert.equal(rightToBuy.good_call, true);
  assert.equal(rightToBuy.final_correct, true);
  assert.equal(rightToBuy.telegraph_correct, true);

  const wasted = settle({ model: "a", guess: 100, decision: "buy", purchase: { ok: true, value: 100, cost_usd: 0.01 } }, 100, tol);
  assert.equal(wasted.good_call, false);
  assert.equal(wasted.wasted_buy, true);
});

test("settle: a failed purchase voids the final answer but still judges the call", () => {
  const e = settle({ model: "a", guess: 80, decision: "buy", purchase: { ok: false, error: "timeout" } }, 100, tol);
  assert.equal(e.voided, true);
  assert.equal(e.final_correct, null);
  assert.equal(e.good_call, true);
});

test("settle: a wrong paid answer is the miner's fault, not the model's judgment", () => {
  const e = settle({ model: "a", guess: 80, decision: "buy", purchase: { ok: true, value: 90, cost_usd: 0.01 } }, 100, tol);
  assert.equal(e.good_call, true);
  assert.equal(e.final_correct, false);
  assert.equal(e.telegraph_correct, false);
});

test("leaderboard ranks judgment first, then true cost", () => {
  const entries = [
    settle({ model: "careful", guess: 80, decision: "buy", purchase: { ok: true, value: 100, cost_usd: 0.01 }, llm_cost_usd: 0.001 }, 100, tol),
    settle({ model: "careful", guess: 50, decision: "answer", llm_cost_usd: 0.001 }, 50, tol),
    settle({ model: "bold", guess: 80, decision: "answer", llm_cost_usd: 0.001 }, 100, tol),
    settle({ model: "bold", guess: 50, decision: "answer", llm_cost_usd: 0.001 }, 50, tol),
    { model: "broken", error: "timeout" },
  ];
  const lb = leaderboard(entries, 0.25);
  assert.deepEqual(lb.map(r => r.model), ["careful", "bold"]);
  const [careful, bold] = lb;
  assert.equal(careful.judgment, 1);
  assert.equal(careful.accuracy, 1);
  assert.equal(careful.cost_per_correct, (0.01 + 0.002) / 2);
  assert.equal(bold.judgment, 0.5);
  assert.equal(bold.overconfident, 1);
  assert.equal(bold.true_cost_per_question, (0.002 + 0.25) / 2);
});

test("accuracy is unknown, not zero, until a final answer is graded", () => {
  const lb = leaderboard([settle({ model: "a", guess: 80, decision: "buy", purchase: { ok: false, error: "fetch failed" } }, 100, tol)], 0.25);
  assert.equal(lb[0].accuracy, null);
  assert.equal(lb[0].judgment, 1);
});
