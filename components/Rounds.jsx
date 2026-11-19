"use client";
// Past rounds, newest first. Open one in place, or go to its own page; more load on request.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ago, plural } from "@/lib/format";
import QuestionCard from "./QuestionCard";
import { ErrorNote, Icon } from "./ui";

function Round({ r, now }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || detail) return;
    fetch(`/api/rounds/${r.id}`).then(async res => {
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setDetail(j);
    }).catch(e => setError(e.message));
  }, [open]);
  const ratio = r.decisions ? r.good_calls / r.decisions : 0;
  return (
    <details className="round" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="t">{r.source === "visitor" ? "Visitor question" : `Round of ${plural(r.questions, "question")}`}
          <span className="faint">{ago(r.started_at, now)} · {r.models} models</span></span>
        <span className="sc">
          {r.decisions > 0 && <span className={`st ${ratio >= 0.7 ? "good" : "accent"}`}>{r.good_calls}/{r.decisions} correct decisions</span>}
          {r.overconfident > 0 && <span className="st bad">{r.overconfident} overconfident</span>}
          <span className="chev"><Icon name="chev" /></span>
        </span>
        <span className="ps">{r.prompts.join(" · ")}</span>
      </summary>
      {open && (
        <div className="body">
          {error ? <ErrorNote>{error}</ErrorNote> : !detail ? <div className="skel" /> : detail.questions.map(q => <QuestionCard key={q.id} q={q} />)}
          <Link className="share" href={`/rounds/${r.id}`}><Icon name="link" />Open this round on its own page</Link>
        </div>
      )}
    </details>
  );
}

export default function Rounds({ initial, now }) {
  const [rounds, setRounds] = useState(initial);
  const [limit, setLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const more = async () => {
    setBusy(true);
    const n = Math.min(50, limit + 20);
    const r = await fetch(`/api/rounds?limit=${n + 1}`).then(x => x.json()).catch(() => null);
    if (Array.isArray(r)) { setRounds(r); setLimit(n); }
    setBusy(false);
  };
  return (
    <section id="rounds">
      <div className="shead"><div>
        <p className="kicker">History</p>
        <h2>Past rounds</h2>
        <p className="sub">Open any round to see each model's guess, its confidence, what it bought, and the receipt for every purchase.</p>
      </div></div>
      <div className="rounds">
        {!rounds.length ? <div className="empty">No rounds yet.</div> : rounds.slice(0, limit).map(r => <Round key={r.id} r={r} now={now} />)}
      </div>
      {rounds.length > limit && limit < 50 && <div className="more"><button className="toggle" onClick={more} disabled={busy}>{busy ? "Loading…" : "Show more rounds"}</button></div>}
    </section>
  );
}
