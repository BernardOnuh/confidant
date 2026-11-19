"use client";
// The ranking: a table on wide screens, cards on phones. "All metrics" shows the extra columns.
import { useState } from "react";
import { pct, usd } from "@/lib/format";
import { Icon, Profile, Who } from "./ui";

const COLS = [
  ["Judgment", "How often it bought exactly when its own answer was wrong, and answered when it was right. Higher is better."],
  ["Accuracy", "How often its final answer was right, whether it bought or not."],
  ["Overconfident", "Times it answered on its own and got it wrong. Lower is better."],
  ["Knew", "How often its own guess was right, whatever it decided.", true],
  ["Bought", "How often it chose to buy.", true],
  ["Wasted buys", "Times it paid for an answer it already had right.", true],
  ["Avg. confidence", "Average confidence it reported.", true],
  ["Cost / correct", "Model tokens plus Telegraph spend, divided by correct answers."],
  ["True cost / q", "All spend plus the cost of each mistake, per question. Lower is better.", true],
];

// One of the top three: its judgment score and the four outcomes behind it.
function Podium({ r, place }) {
  const m = r.matrix || {};
  const cell = (n, cls, label) => <div className={`c ${cls}${n ? "" : " zero"}`}>{n ?? 0}<small>{label}</small></div>;
  return (
    <div className={`pod${place === 0 ? " first" : ""}`}>
      <div className="place"><span>{["1ST", "2ND", "3RD"][place]}</span><Profile r={r} /></div>
      <Who model={r.model} />
      <div className="score">{pct(r.judgment)}<small>judgment</small></div>
      <div className="sub2">{r.questions} decisions · {pct(r.accuracy)} accurate · bought {pct(r.buy_rate)} of the time</div>
      <div className="matrix" aria-label="What it did when it knew the answer, and when it didn't">
        <span /><span className="h">Answered</span><span className="h">Bought</span>
        <span className="rl">Knew it</span>{cell(m.knew_answered, "good", "right call")}{cell(m.knew_bought, "meh", "wasted $0.01")}
        <span className="rl">Didn't</span>{cell(m.missed_answered, "bad", "overconfident")}{cell(m.missed_bought, "good", "right to buy")}
      </div>
    </div>
  );
}

export default function Leaderboard({ rows, updated, mistakeCost }) {
  const [all, setAll] = useState(false);
  const rank = i => String(i + 1).padStart(2, "0");
  return (
    <section id="leaderboard">
      <div className="shead">
        <div>
          <p className="kicker">Leaderboard</p>
          <h2>Ranked by judgment</h2>
          <p className="sub">The best model is not the one that knows the most, but the one that knows when to ask: it pays only when its own answer would have been wrong. {updated && <span className="faint">{updated}</span>}</p>
        </div>
        <button className="toggle" id="more-cols" onClick={() => setAll(!all)}><Icon name="sliders" /><span>{all ? "Fewer metrics" : "All metrics"}</span></button>
      </div>

      {rows.length > 0 && (
        <div className="podium">
          {rows.slice(0, 3).map((r, i) => <Podium key={r.model} r={r} place={i} />)}
        </div>
      )}

      <div className={`tablewrap lbtable ${all ? "show-extra" : ""}`}>
        <table>
          <thead><tr>
            <th className="l">#</th><th className="l">Model</th>
            {COLS.map(([name, tip, extra]) => <th key={name} className={extra ? "extra" : ""} title={tip}>{name}</th>)}
            <th className="l">Profile</th>
          </tr></thead>
          <tbody>
            {!rows.length ? (
              <tr><td colSpan={12} className="l"><div className="empty">No rounds yet. Ask the models a question below to start the leaderboard.</div></td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.model} className={i === 0 ? "lead" : ""}>
                <td className="l rank">{rank(i)}</td>
                <td className="l"><Who model={r.model} /></td>
                <td><span className="bar"><i><b style={{ width: `${Math.round(r.judgment * 100)}%` }} /></i>{pct(r.judgment)}</span></td>
                <td>{pct(r.accuracy)}</td>
                <td className={r.overconfident ? "bad" : "faint"}>{r.overconfident}</td>
                <td className="extra">{pct(r.knew)}</td>
                <td className="extra">{pct(r.buy_rate)}</td>
                <td className="extra">{r.wasted_buys}</td>
                <td className="extra">{pct(r.avg_confidence)}</td>
                <td>{usd(r.cost_per_correct)}</td>
                <td className="extra">{usd(r.true_cost_per_question)}</td>
                <td className="l"><Profile r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lbcards">
        {!rows.length ? <div className="empty">No rounds yet.</div> : rows.map((r, i) => (
          <div className="lbcard" key={r.model}>
            <div className="top"><span className="rank mono">{rank(i)}</span><Who model={r.model} /></div>
            <div className="prof"><Profile r={r} /></div>
            <div className="grid">
              <div><b>{pct(r.judgment)}</b><span>Judgment</span></div>
              <div><b>{pct(r.accuracy)}</b><span>Accuracy</span></div>
              <div><b className={r.overconfident ? "bad" : ""}>{r.overconfident}</b><span>Overconfident</span></div>
            </div>
          </div>
        ))}
      </div>

      <details className="glossary">
        <summary><Icon name="info" />What the metrics mean</summary>
        <div className="legend">
          <div><b>Judgment.</b> Bought when its guess was wrong; answered when its guess was right. The primary score.</div>
          <div><b>Accuracy.</b> Final answers that were correct, bought or not.</div>
          <div><b>Overconfident.</b> Answered alone and was wrong. Each costs ${mistakeCost.toFixed(2)}.</div>
          <div><b>Knew.</b> How often its own guess was right, whatever it decided.</div>
          <div><b>Wasted buys.</b> Paid for an answer it already had right.</div>
          <div><b>True cost / question.</b> Model and Telegraph spend, plus the price of every mistake.</div>
        </div>
      </details>
    </section>
  );
}
