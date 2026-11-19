// One question's result: the true answer, and each model's guess, decision, purchase and verdict.
import { niceError, num, pct } from "@/lib/format";
import { Icon, Who } from "./ui";

function Verdict({ e }) {
  if (e.voided) return <span className="badge"><Icon name="minus" />Purchase failed</span>;
  if (e.overconfident) return <span className="badge bad"><Icon name="x" />Overconfident</span>;
  if (e.wasted_buy) return <span className="badge buy"><Icon name="minus" />Unneeded buy</span>;
  if (e.good_call && e.decision === "buy") return <span className="badge good"><Icon name="check" />Right to buy</span>;
  if (e.good_call) return <span className="badge good"><Icon name="check" />Knew it</span>;
  return null;
}

function Entry({ e, unit }) {
  if (e.error) {
    return (
      <div className="entry err">
        <div className="row"><Who model={e.model} /><span className="badge"><Icon name="minus" />No answer</span></div>
        <div className="faint" title={e.error}>{niceError(e.error)}</div>
      </div>
    );
  }
  const p = e.purchase, conf = e.confidence ?? null;
  return (
    <div className="entry">
      <div className="row"><Who model={e.model} /><Verdict e={e} /></div>
      <div className="guess">Own guess <b>{num(e.guess)}</b> {unit} · <span className={e.guess_correct ? "good" : "bad"}>{e.guess_correct ? "correct" : "incorrect"}</span></div>
      {conf !== null && (
        <div>
          <div className="row" style={{ fontSize: 12 }}><span className="faint">Stated confidence</span><span className="mono dim">{pct(conf)}</span></div>
          <div className="conf"><i style={{ width: `${Math.round(conf * 100)}%` }} /></div>
        </div>
      )}
      <div className="act">
        {e.decision === "buy" ? (
          p?.ok ? (
            <><Icon name="shield-check" /><span>Bought <b>{num(p.value)}</b> from Telegraph
              {p.signal_url && <> · <a href={p.signal_url} target="_blank" rel="noopener">Receipt <Icon name="ext" /></a></>}</span></>
          ) : <><Icon name="shield-check" /><span>Purchase failed: {niceError(p?.error || "unknown error")}</span></>
        ) : <><Icon name="cpu" /><span>Answered from memory</span></>}
      </div>
      {e.why && <div className="why">{e.why.slice(0, 220)}</div>}
    </div>
  );
}

export default function QuestionCard({ q }) {
  if (q.void) {
    return (
      <div className="q"><div className="qhead"><div>
        <div className="p">{q.prompt}</div>
        <div className="meta">Discarded: no trustworthy answer was available ({q.void_reason})</div>
      </div></div></div>
    );
  }
  const truth = Array.isArray(q.truth) ? q.truth.map(num).join(" or ") : num(q.truth);
  const ok = q.entries.filter(e => !e.error);
  const good = ok.filter(e => e.good_call).length, bought = ok.filter(e => e.decision === "buy").length, over = ok.filter(e => e.overconfident).length;
  return (
    <div className="q">
      <div className="qhead">
        <div><div className="p">{q.prompt}</div><div className="meta">Intent {q.intent} · verified against {q.truth_source}</div></div>
        <div className="truth"><div className="lbl">True answer</div><div className="v">{truth} <small>{q.unit}</small></div></div>
      </div>
      <div className="qsum">
        <span><b>{good}/{ok.length}</b> correct decisions</span>
        <span><b>{bought}</b> bought</span>
        <span><b className={over ? "bad" : ""}>{over}</b> overconfident</span>
      </div>
      <div className="entries">{q.entries.map((e, i) => <Entry key={e.model + i} e={e} unit={q.unit} />)}</div>
    </div>
  );
}
