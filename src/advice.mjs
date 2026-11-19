// Judgment as a product. From every graded decision so far, Confidant knows how often each model is right on each
// topic, and how often Telegraph is. advise() turns that into a recommendation for one model on one topic;
// savings() replays the history under four strategies to show what that recommendation is worth.

const PRICE = 0.01; // what one Telegraph answer costs

// Graded, error-free decisions, each tagged with its round and topic.
export function decisionsOf(rounds) {
  return rounds.flatMap(r => r.questions.filter(q => !q.void).flatMap(q => {
    // Telegraph's answer for this question, as judged against the truth (any model that bought it will do).
    const tg = q.entries.find(e => e.telegraph_correct === true || e.telegraph_correct === false)?.telegraph_correct ?? null;
    return q.entries.filter(e => !e.error && e.guess_correct !== undefined && !e.voided)
      .map(e => ({ round: r.id, topic: q.category, model: e.model, knew: !!e.guess_correct, decision: e.decision, tg }));
  }));
}

// Counts per model and topic, and Telegraph's record per topic.
function tally(ds) {
  const m = new Map(), tg = new Map(), pooled = new Map();
  const add = (map, k, ok) => { const c = map.get(k) || { n: 0, ok: 0 }; c.n++; c.ok += ok ? 1 : 0; map.set(k, c); };
  for (const d of ds) {
    add(m, `${d.model}|${d.topic}`, d.knew);
    add(pooled, d.topic, d.knew);
    if (d.tg !== null) add(tg, d.topic, d.tg);
  }
  return { m, tg, pooled };
}

// Laplace-smoothed rate, so one lucky answer doesn't read as 100%.
const rate = (c, prior = 0.5) => (c ? (c.ok + 2 * prior) / (c.n + 2) : prior);

function decide(t, model, topic, mistake) {
  const own = t.m.get(`${model}|${topic}`);
  const basis = own && own.n >= 3 ? own : t.pooled.get(topic);
  const pKnow = rate(basis, 0.5);
  const pTg = rate(t.tg.get(topic), 0.9);
  const costAnswer = (1 - pKnow) * mistake;
  const costBuy = PRICE + (1 - pTg) * mistake;
  return { advice: costBuy < costAnswer ? "buy" : "answer", pKnow, pTg, costAnswer, costBuy, samples: own?.n || 0, pooled: basis !== own };
}

export function advise(rounds, { model, topic, mistake = 0.25 }) {
  const ds = decisionsOf(rounds);
  const t = tally(ds);
  const d = decide(t, model, topic, mistake);
  const pct = x => Math.round(x * 100) + "%";
  const reason = d.advice === "buy"
    ? `${d.pooled ? "Models in general are" : "This model is"} right about ${pct(d.pKnow)} of the time on this topic. At $${mistake.toFixed(2)} per mistake, paying $${PRICE.toFixed(2)} for Telegraph (right ${pct(d.pTg)} of the time) costs less.`
    : `${d.pooled ? "Models in general are" : "This model is"} right about ${pct(d.pKnow)} of the time on this topic, so its own answer is cheaper than paying $${PRICE.toFixed(2)} for Telegraph.`;
  return {
    model, topic, advice: d.advice, reason,
    model_accuracy: +d.pKnow.toFixed(3),
    telegraph_accuracy: +d.pTg.toFixed(3),
    expected_cost_usd: { answer: +d.costAnswer.toFixed(4), buy: +d.costBuy.toFixed(4) },
    saving_usd: +Math.abs(d.costAnswer - d.costBuy).toFixed(4),
    samples: d.samples,
    based_on: d.pooled ? `all models' record on ${topic} (fewer than 3 graded decisions for this model)` : `${d.samples} graded decisions by this model on ${topic}`,
    confidence: d.samples >= 10 ? "high" : d.samples >= 3 ? "medium" : "low",
    mistake_cost_usd: mistake,
    telegraph_price_usd: PRICE,
  };
}

// What four strategies would have cost on the same real decisions: never buy, always buy, follow Confidant, and a
// perfect oracle. Confidant's advice for each decision uses only the other rounds, so it never sees the answer.
export function savings(rounds, mistake = 0.25) {
  const ds = decisionsOf(rounds);
  if (!ds.length) return { decisions: 0, strategies: [] };
  const all = tally(ds);
  const byRound = new Map();
  for (const d of ds) (byRound.get(d.round) || byRound.set(d.round, []).get(d.round)).push(d);
  const tgRate = topic => rate(all.tg.get(topic), 0.9);

  const totals = { never: [0, 0, 0], always: [0, 0, 0], actual: [0, 0, 0], confidant: [0, 0, 0], oracle: [0, 0, 0] }; // cost, mistakes, buys
  const run = (k, buy, d) => {
    const tgWrong = d.tg === null ? 1 - tgRate(d.topic) : d.tg ? 0 : 1;
    const wrong = buy ? tgWrong : d.knew ? 0 : 1;
    totals[k][0] += (buy ? PRICE : 0) + wrong * mistake;
    totals[k][1] += wrong;
    totals[k][2] += buy ? 1 : 0;
  };
  for (const [round, list] of byRound) {
    const held = tally(ds.filter(d => d.round !== round));
    for (const d of list) {
      run("never", false, d);
      run("always", true, d);
      run("actual", d.decision === "buy", d);
      run("confidant", decide(held, d.model, d.topic, mistake).advice === "buy", d);
      run("oracle", !d.knew, d);
    }
  }
  const n = ds.length;
  const LABELS = {
    never: ["Trust the model", "Never buy; every wrong answer costs the mistake"],
    always: ["Always buy", "Pay Telegraph for every answer"],
    actual: ["Models' own choice", "What the models actually decided"],
    confidant: ["Follow Confidant", "Buy only when Confidant's record says it's worth it"],
    oracle: ["Perfect hindsight", "Buy exactly when the model would be wrong (the floor)"],
  };
  const strategies = Object.entries(totals).map(([id, [cost, wrong, buys]]) => ({
    id, label: LABELS[id][0], detail: LABELS[id][1],
    cost_per_100: +(cost / n * 100).toFixed(2), mistakes_per_100: +(wrong / n * 100).toFixed(1), buys_per_100: +(buys / n * 100).toFixed(1),
  }));
  const get = id => strategies.find(s => s.id === id);
  const c = get("confidant"), al = get("always"), nv = get("never");
  return {
    decisions: n, rounds: byRound.size, mistake_cost_usd: mistake, telegraph_price_usd: PRICE,
    strategies,
    headline: {
      vs_always_pct: al.cost_per_100 ? Math.round((1 - c.cost_per_100 / al.cost_per_100) * 100) : 0,
      vs_never_pct: nv.cost_per_100 ? Math.round((1 - c.cost_per_100 / nv.cost_per_100) * 100) : 0,
      fewer_mistakes_x: c.mistakes_per_100 ? +(nv.mistakes_per_100 / c.mistakes_per_100).toFixed(1) : null,
      gap_to_hindsight_pct: get("oracle").cost_per_100 ? Math.round((c.cost_per_100 / get("oracle").cost_per_100 - 1) * 100) : 0,
    },
  };
}
