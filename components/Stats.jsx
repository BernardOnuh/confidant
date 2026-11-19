// The four headline numbers.
import { pct } from "@/lib/format";

export default function Stats({ summary: s }) {
  return (
    <div className="stats">
      <div className="stat"><b>{s.rounds.toLocaleString("en-US")}</b><span>Rounds played</span></div>
      <div className="stat"><b>{s.decisions.toLocaleString("en-US")}</b><span>Decisions graded</span></div>
      <div className="stat"><b>{s.telegraph.purchases.toLocaleString("en-US")}</b><span>Answers bought on Telegraph</span></div>
      <div className="stat"><b className="gold">{s.telegraph.purchases ? pct(s.telegraph.correct / s.telegraph.purchases) : "–"}</b><span>Bought answers correct</span></div>
    </div>
  );
}
