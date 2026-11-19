// What judgment is worth: the same real decisions replayed under five strategies, priced at $0.01 per purchase
// and the stated cost of each mistake. Confidant's advice for each decision only uses the other rounds.
export function SavingsHeadline({ s }) {
  const h = s.headline;
  return (
    <div className="vals">
      <div><b className="gold">{h.vs_never_pct}%</b><span>cheaper than trusting the model</span></div>
      <div><b>{h.fewer_mistakes_x ?? "–"}×</b><span>fewer costly mistakes</span></div>
      <div><b>{Math.max(0, h.gap_to_hindsight_pct)}%</b><span>off perfect hindsight (the best possible)</span></div>
    </div>
  );
}

export default function Savings({ s }) {
  if (!s?.decisions) return <section id="value"><div className="empty">No graded decisions yet.</div></section>;
  const max = Math.max(...s.strategies.map(x => x.cost_per_100));
  const h = s.headline;
  const order = ["never", "actual", "always", "confidant", "oracle"];
  const rows = order.map(id => s.strategies.find(x => x.id === id)).filter(Boolean);
  return (
    <section id="value">
      <div className="shead"><div>
        <p className="kicker">What judgment is worth</p>
        <h2>An agent that follows Confidant spends {h.vs_never_pct}% less than one that trusts its model</h2>
        <p className="sub">The same {s.decisions} real decisions from {s.rounds} rounds, replayed under each strategy at ${s.telegraph_price_usd.toFixed(2)} per purchase and ${s.mistake_cost_usd.toFixed(2)} per wrong answer. Confidant's advice for each decision is worked out without that decision's round, so it never sees the answer.</p>
      </div></div>
      <SavingsHeadline s={s} />
      <div className="strats">
        {rows.map(x => (
          <div key={x.id} className={`strat ${x.id === "confidant" ? "us" : ""} ${x.id === "oracle" ? "floor" : ""}`}>
            <div className="sl"><b>{x.label}</b><small>{x.detail}</small></div>
            <div className="sb"><i style={{ width: `${Math.max(2, (x.cost_per_100 / max) * 100)}%` }} /></div>
            <div className="sv"><b>${x.cost_per_100.toFixed(2)}</b><small>per 100 questions · {x.mistakes_per_100} wrong</small></div>
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 13, marginTop: 14, maxWidth: 760 }}>
        Most questions so far are live data no model can know, so Confidant mostly says "buy". On facts a model reliably knows, it says "answer" and saves the $0.01; that gap grows with every round.
      </p>
    </section>
  );
}
