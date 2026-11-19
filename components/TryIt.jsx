"use client";
// Visitors pick a topic and subject; every model answers live, buys if it chooses to, and is graded on the spot.
import { useEffect, useRef, useState } from "react";
import { HINTS } from "@/lib/format";
import QuestionCard from "./QuestionCard";
import { ErrorNote, Icon, Who } from "./ui";

const ICONS = { crypto: "coins", fx: "swap", weather: "thermo", gas: "flame", cve: "shield-alert" };
const PHASES = ["Models are deciding", "Purchasing answers on Telegraph", "Fetching the true answer", "Grading decisions"];
const CVE = /^CVE-\d{4}-\d{4,7}$/;

export default function TryIt({ options, onDone }) {
  const cats = Object.entries(options.categories);
  const [cat, setCat] = useState("crypto");
  const [subject, setSubject] = useState(options.categories.crypto?.subjects[0] ?? "");
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState(-1); // -1 idle, 0.. running
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const out = useRef(null);

  useEffect(() => {
    if (phase < 0) return;
    const t = setInterval(() => setPhase(p => Math.min(p + 1, PHASES.length - 1)), 4000);
    return () => clearInterval(t);
  }, [phase >= 0]);

  const pickCat = k => { setCat(k); setSubject(options.categories[k].subjects[0]); setTyped(""); };
  const subs = options.categories[cat].subjects;

  async function ask() {
    if (cat === "cve" && !CVE.test(subject)) return setError("Enter a CVE ID in the form CVE-2024-3094.");
    setError(""); setResult(null); setPhase(0);
    try {
      const r = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: cat, subject }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(r.status === 429
          ? (/busy/.test(j.error) ? "The models are answering another visitor's question. Please try again in a minute." : "You have used your questions for this hour. Past rounds are available below.")
          : j.error || `Something went wrong (${r.status}).`);
      }
      setResult(j);
      onDone?.();
      setTimeout(() => out.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setPhase(-1);
    }
  }

  return (
    <section id="try">
      <div className="shead"><div>
        <p className="kicker">Try it</p>
        <h2>Ask the models yourself</h2>
        <p className="sub">Choose a question. Each model answers live, buys from Telegraph if it chooses to, and is graded immediately. Limited to {options.try_per_hour} questions per hour.</p>
      </div></div>
      <div className="try">
        <div className="pane">
          <p className="step">01 · Topic</p>
          <div className="chips">
            {cats.map(([k, c]) => (
              <button key={k} className="chip" aria-pressed={cat === k} onClick={() => pickCat(k)}><Icon name={ICONS[k] || "info"} size="" />{c.label}</button>
            ))}
          </div>
        </div>
        {subs.length > 1 && (
          <div className="pane">
            <p className="step">02 · Subject</p>
            <div className="chips subjects">
              {subs.map(s => <button key={s} className="chip" aria-pressed={!typed && subject === s} onClick={() => { setSubject(s); setTyped(""); }}>{s}</button>)}
              {cat === "cve" && (
                <div className="cvebox"><span>Or enter any CVE ID</span>
                  <input value={typed} placeholder="CVE-2024-3094" autoComplete="off" spellCheck="false"
                    onChange={e => { setTyped(e.target.value); const v = e.target.value.trim().toUpperCase(); if (v) setSubject(v); }} />
                </div>
              )}
            </div>
          </div>
        )}
        <div className="pane askbar">
          <div className="preview">{HINTS[cat](subject)}<small>{options.models.length} models will decide whether to answer or buy.</small></div>
          <button className="btn primary" onClick={ask} disabled={phase >= 0}>{phase >= 0 ? "Running…" : "Ask the models"}</button>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        {phase >= 0 && (
          <div className="pane progress" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="phase"><span className="spin" />{PHASES[phase]}…</div>
            <div className="thinking">{options.models.map(m => <div key={m}><Who model={m} /><span className="wait">Pending</span></div>)}</div>
          </div>
        )}
        <div ref={out}>{result?.questions.map(q => <QuestionCard key={q.id} q={q} />)}</div>
      </div>
    </section>
  );
}
