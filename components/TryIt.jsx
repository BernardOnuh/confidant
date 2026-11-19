"use client";
// Visitors pick a question; the models' answers stream in live: each card fills in as that model decides,
// purchases appear with their receipts, then the true answer arrives and every card is graded.
import { useRef, useState } from "react";
import { HINTS, niceError, num, pct } from "@/lib/format";
import { ErrorNote, Icon, Who } from "./ui";

const ICONS = { crypto: "coins", fx: "swap", weather: "thermo", gas: "flame", cve: "shield-alert" };
const CVE = /^CVE-\d{4}-\d{4,7}$/;

function grade(e) {
  if (!e?.graded) return { cls: "", badge: null };
  if (e.error) return { cls: "err", badge: <span className="badge"><Icon name="minus" />No answer</span> };
  if (e.overconfident) return { cls: "bad", badge: <span className="badge bad"><Icon name="x" />Overconfident</span> };
  if (e.wasted_buy) return { cls: "meh", badge: <span className="badge buy"><Icon name="minus" />Unneeded buy</span> };
  if (e.voided) return { cls: "", badge: <span className="badge"><Icon name="minus" />Purchase failed</span> };
  if (e.good_call) return { cls: "good", badge: <span className="badge good"><Icon name="check" />{e.decision === "buy" ? "Right to buy" : "Knew it"}</span> };
  return { cls: "", badge: null };
}

function LiveCard({ model, e, unit }) {
  const g = grade(e);
  return (
    <div className={`lcard ${e ? "in" : ""} ${g.cls}`}>
      <div className="row"><Who model={model} />{g.badge || (!e ? <span className="faint" style={{ fontSize: 12 }}>Thinking…</span> : null)}</div>
      {!e ? (<><div className="bar2" style={{ width: "70%" }} /><div className="bar2" style={{ width: "45%" }} /></>)
        : e.error ? <div className="faint" style={{ fontSize: 13 }} title={e.error}>{niceError(e.error)}</div>
        : (
          <>
            <div className="lg">Guess <b>{num(e.guess)}</b> {unit}{e.graded && <> · <span className={e.guess_correct ? "good" : "bad"}>{e.guess_correct ? "right" : "wrong"}</span></>}</div>
            <div className={`pill2 ${e.decision === "buy" ? "buy" : ""}`}>
              <Icon name={e.decision === "buy" ? "shield-check" : "cpu"} />
              {e.decision === "buy" ? "Buys on Telegraph" : "Answers from memory"}
            </div>
            {e.confidence !== null && e.confidence !== undefined && (
              <div><div className="row" style={{ fontSize: 12 }}><span className="faint">Confidence</span><span className="mono dim">{pct(e.confidence)}</span></div>
                <div className="conf"><i style={{ width: `${Math.round(e.confidence * 100)}%` }} /></div></div>
            )}
            {e.decision === "buy" && (
              <div className="act">
                {!e.purchase ? <><span className="spin" />Paying a miner…</>
                  : e.purchase.ok ? <>Bought <b className="mono">{num(e.purchase.value)}</b>{e.purchase.signal_url && <a href={e.purchase.signal_url} target="_blank" rel="noopener">Receipt <Icon name="ext" /></a>}</>
                  : <>Purchase failed: {niceError(e.purchase.error)}</>}
              </div>
            )}
            {e.why && <div className="why">{e.why.slice(0, 160)}</div>}
          </>
        )}
    </div>
  );
}

export default function TryIt({ options, onDone }) {
  const cats = Object.entries(options.categories);
  const [cat, setCat] = useState("crypto");
  const [subject, setSubject] = useState(options.categories.crypto?.subjects[0] ?? "");
  const [typed, setTyped] = useState("");
  const [run, setRun] = useState(null); // { question, models, entries: {model: entry}, truth, done }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const out = useRef(null);

  const pickCat = k => { setCat(k); setSubject(options.categories[k].subjects[0]); setTyped(""); };
  const subs = options.categories[cat].subjects;

  async function ask() {
    if (cat === "cve" && !CVE.test(subject)) return setError("Enter a CVE ID in the form CVE-2024-3094.");
    setError(""); setBusy(true); setRun(null);
    try {
      const res = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: cat, subject }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(res.status === 429
          ? (/busy/.test(j.error) ? "The models are answering another visitor's question. Please try again in a minute." : "You have used your questions for this hour. Past rounds are available below.")
          : j.error || `Something went wrong (${res.status}).`);
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const ev = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
          apply(ev);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function apply(ev) {
    if (ev.type === "start") {
      setRun({ question: ev.question, models: ev.models, entries: {}, truth: null, done: false });
      setTimeout(() => out.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } else if (ev.type === "decision") {
      setRun(r => ({ ...r, entries: { ...r.entries, [ev.model]: ev } }));
    } else if (ev.type === "purchase") {
      setRun(r => ({ ...r, entries: { ...r.entries, [ev.model]: { ...r.entries[ev.model], purchase: ev.purchase } } }));
    } else if (ev.type === "truth") {
      setRun(r => ({ ...r, truth: { value: ev.truth, source: ev.source } }));
    } else if (ev.type === "graded") {
      const q = ev.question;
      setRun(r => ({ ...r, voided: q.void ? q.void_reason : null,
        entries: Object.fromEntries(q.entries.map(e => [e.model, { ...e, graded: true }])) }));
    } else if (ev.type === "done") {
      setRun(r => ({ ...r, done: true, roundId: ev.round.id }));
      onDone?.();
    } else if (ev.type === "error") {
      setError(ev.error);
    }
  }

  const list = run ? Object.values(run.entries) : [];
  const decided = list.length, buying = list.filter(e => e.decision === "buy").length;
  const graded = list.filter(e => e.graded && !e.error);
  const good = graded.filter(e => e.good_call).length, over = graded.filter(e => e.overconfident).length;
  const phase = !run ? "" : run.done ? "Graded" : run.truth ? "Grading decisions" : decided < run.models.length ? `Models are deciding (${decided}/${run.models.length})` : buying ? "Buying answers on Telegraph" : "Fetching the true answer";

  return (
    <section id="try">
      <div className="shead"><div>
        <p className="kicker">Try it live</p>
        <h2>Put a question to the models</h2>
        <p className="sub">Pick one. You'll watch each model guess, decide whether to pay for a verified answer, and get graded against the real world. {options.try_per_hour} questions per visitor per hour.</p>
      </div></div>
      <div className="try">
        <div className="pane">
          <p className="step">01 · Topic</p>
          <div className="chips">
            {cats.map(([k, c]) => (
              <button key={k} className="chip" aria-pressed={cat === k} onClick={() => pickCat(k)} disabled={busy}><Icon name={ICONS[k] || "info"} size="" />{c.label}</button>
            ))}
          </div>
        </div>
        {subs.length > 1 && (
          <div className="pane">
            <p className="step">02 · Subject</p>
            <div className="chips subjects">
              {subs.map(s => <button key={s} className="chip" disabled={busy} aria-pressed={!typed && subject === s} onClick={() => { setSubject(s); setTyped(""); }}>{s}</button>)}
              {cat === "cve" && (
                <div className="cvebox"><span>Or enter any CVE ID</span>
                  <input value={typed} placeholder="CVE-2024-3094" autoComplete="off" spellCheck="false" disabled={busy}
                    onChange={e => { setTyped(e.target.value); const v = e.target.value.trim().toUpperCase(); if (v) setSubject(v); }} />
                </div>
              )}
            </div>
          </div>
        )}
        <div className="pane try-q">
          <div className="preview">{HINTS[cat](subject)}<small>{options.models.length} models will each decide: trust memory, or pay $0.01 to be sure.</small></div>
          <button className="btn primary" onClick={ask} disabled={busy}>{busy ? <><span className="spin" style={{ borderTopColor: "var(--primary-ink)" }} />Running…</> : <>Ask the models <Icon name="arrow" /></>}</button>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div ref={out}>
          {run && (
            <>
              <div className="livehead">
                <div className="phase">{!run.done && <span className="spin" />}{run.done && <Icon name="check" />}{phase}</div>
                <div className="tally">
                  <span><b>{decided}</b>/{run.models.length} decided</span>
                  <span><b>{buying}</b> buying</span>
                  {graded.length > 0 && <><span><b className="good">{good}</b> good calls</span><span><b className={over ? "bad" : ""}>{over}</b> overconfident</span></>}
                </div>
              </div>
              {run.truth && (
                <div className="truthbar">
                  <div><div className="kicker" style={{ margin: 0 }}>True answer · {run.truth.source}</div>
                    <div className="v">{Array.isArray(run.truth.value) ? run.truth.value.map(num).join(" or ") : num(run.truth.value)}<small>{run.question.unit}</small></div></div>
                  {run.done && run.roundId && <a href={`#round-${run.roundId}`} className="faint" style={{ fontSize: 13 }}>Saved to past rounds</a>}
                </div>
              )}
              {run.voided && <ErrorNote>Discarded: no trustworthy answer was available ({run.voided})</ErrorNote>}
              <div className="live-grid">{run.models.map(m => <LiveCard key={m} model={m} e={run.entries[m]} unit={run.question.unit} />)}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
