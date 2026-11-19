// Grading and scoring. Pure functions, so they're easy to test.

export function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?(e-?\d+)?/i);
  return m ? Number(m[0]) : null;
}

// truth is a number, or a list of acceptable numbers (CVSS has several versions).
export function isCorrect(answer, truth, tol) {
  const a = toNumber(answer);
  if (a === null || truth === null || truth === undefined) return false;
  const targets = Array.isArray(truth) ? truth : [truth];
  return targets.some(t => {
    const diff = Math.abs(a - t);
    if (tol.abs !== undefined && diff <= tol.abs) return true;
    if (tol.rel !== undefined && diff <= Math.abs(t) * tol.rel) return true;
    return false;
  });
}

export function toleranceText(tol, unit) {
  const parts = [];
  if (tol.rel !== undefined) parts.push(`${+(tol.rel * 100).toFixed(1)}%`);
  if (tol.abs !== undefined) parts.push(`${tol.abs} ${unit}`);
  return "within " + parts.join(" or ");
}

// Pull the first JSON object out of a model's reply, tolerating code fences and chatter.
export function parseDecision(text) {
  if (!text) return null;
  const s = String(text).replace(/```(?:json)?/gi, "");
  for (let i = s.indexOf("{"); i !== -1; i = s.indexOf("{", i + 1)) {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}" && --depth === 0) {
        try {
          const o = JSON.parse(s.slice(i, j + 1));
          const decision = String(o.decision || "").toLowerCase().includes("buy") ? "buy" : "answer";
          const confidence = Math.min(1, Math.max(0, Number(o.confidence)));
          return { guess: toNumber(o.guess), confidence: Number.isFinite(confidence) ? confidence : null, decision, why: String(o.why || "").slice(0, 240) };
        } catch { break; }
      }
    }
  }
  return null;
}

// One model on one question, once the truth is known.
// A good decision is buying when your own guess would have been wrong, and answering when it would have been right.
export function settle(entry, truth, tol) {
  const guessRight = isCorrect(entry.guess, truth, tol);
  const bought = entry.decision === "buy";
  const voided = bought && !entry.purchase?.ok;     // the purchase failed: no final answer to grade
  const finalAnswer = bought ? entry.purchase?.value ?? null : entry.guess;
  return {
    ...entry,
    guess_correct: guessRight,
    final_answer: finalAnswer,
    final_correct: voided ? null : isCorrect(finalAnswer, truth, tol),
    telegraph_correct: bought && entry.purchase?.ok ? isCorrect(entry.purchase.value, truth, tol) : null,
    good_call: bought ? !guessRight : guessRight,
    overconfident: !bought && !guessRight,
    wasted_buy: bought && guessRight,
    voided,
  };
}

// Aggregate settled entries into leaderboard rows.
export function leaderboard(entries, mistakeCost = 0.25) {
  const by = new Map();
  for (const e of entries) {
    if (e.error) continue;
    const r = by.get(e.model) || { model: e.model, questions: 0, graded: 0, correct: 0, good_calls: 0, bought: 0, overconfident: 0,
      wasted_buys: 0, telegraph_usd: 0, llm_usd: 0, conf_sum: 0, guess_right: 0, knew_answered: 0, missed_bought: 0 };
    r.questions++;
    r.good_calls += e.good_call ? 1 : 0;
    r.bought += e.decision === "buy" ? 1 : 0;
    r.overconfident += e.overconfident ? 1 : 0;
    r.wasted_buys += e.wasted_buy ? 1 : 0;
    r.telegraph_usd += e.purchase?.ok ? e.purchase.cost_usd || 0 : 0;
    r.llm_usd += e.llm_cost_usd || 0;
    r.conf_sum += e.confidence ?? 0;
    r.guess_right += e.guess_correct ? 1 : 0;
    r.knew_answered += e.guess_correct && e.decision !== "buy" ? 1 : 0;
    r.missed_bought += !e.guess_correct && e.decision === "buy" ? 1 : 0;
    if (e.final_correct !== null && e.final_correct !== undefined) {
      r.graded++;
      r.correct += e.final_correct ? 1 : 0;
    }
    by.set(e.model, r);
  }
  return [...by.values()].map(r => {
    const spend = r.telegraph_usd + r.llm_usd;
    const wrong = r.graded - r.correct;
    return {
      model: r.model,
      questions: r.questions,
      judgment: r.good_calls / r.questions,                 // share of right buy/answer calls
      accuracy: r.graded ? r.correct / r.graded : null,  // null until a final answer has been graded
      buy_rate: r.bought / r.questions,
      overconfident: r.overconfident,
      wasted_buys: r.wasted_buys,
      telegraph_usd: r.telegraph_usd,
      llm_usd: r.llm_usd,
      cost_per_correct: r.correct ? spend / r.correct : null,
      // What a principal actually loses per question: everything spent, plus the stated price of each mistake.
      true_cost_per_question: (spend + wrong * mistakeCost) / r.questions,
      avg_confidence: r.conf_sum / r.questions,
      knew: r.guess_right / r.questions,                     // how often its own guess was right
      // The four outcomes behind judgment: the two good calls and the two mistakes.
      matrix: { knew_answered: r.knew_answered, knew_bought: r.wasted_buys, missed_bought: r.missed_bought, missed_answered: r.overconfident },
    };
  }).sort((a, b) => b.judgment - a.judgment || a.true_cost_per_question - b.true_cost_per_question);
}
