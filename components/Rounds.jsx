"use client";
// Past rounds, newest first. A round's detail loads when it is opened; #round-<id> in the address opens one directly.
import { useEffect, useState } from "react";
import { ago, plural } from "@/lib/format";
import QuestionCard from "./QuestionCard";
import { ErrorNote, Icon } from "./ui";

function Round({ r, open: startOpen, now }) {
  const [open, setOpen] = useState(startOpen);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (startOpen) setOpen(true); }, [startOpen]);

  useEffect(() => {
    if (!open || detail) return;
    fetch(`/api/rounds/${r.id}`).then(async res => {
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setDetail(j);
    }).catch(e => setError(e.message));
  }, [open]);

  const copy = () => {
    navigator.clipboard?.writeText(`${location.origin}/#round-${r.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  const ratio = r.decisions ? r.good_calls / r.decisions : 0;
  return (
    <details className="round" id={`round-${r.id}`} open={open} onToggle={e => setOpen(e.currentTarget.open)}>
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
          {detail && <button className="share" onClick={copy}><Icon name="link" />{copied ? "Link copied" : "Copy link to this round"}</button>}
        </div>
      )}
    </details>
  );
}

export default function Rounds({ rounds, now, onMore, more }) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(location.hash);
    if (location.hash.startsWith("#round-")) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" }), 100);
  }, []);
  return (
    <section id="rounds">
      <div className="shead"><div>
        <p className="kicker">History</p>
        <h2>Past rounds</h2>
        <p className="sub">Open any round to see each model's guess, its confidence, what it bought, and the receipt for every purchase.</p>
      </div></div>
      <div className="rounds">
        {!rounds.length ? <div className="empty">No rounds yet.</div>
          : rounds.map(r => <Round key={r.id} r={r} now={now} open={hash === `#round-${r.id}`} />)}
      </div>
      {more && <div className="more"><button className="toggle" onClick={onMore}>Show more rounds</button></div>}
    </section>
  );
}
