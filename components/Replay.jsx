"use client";
// The hero's moving example: real decisions from past rounds, played back one step at a time:
// the question, the model's guess and confidence, its choice, then the true answer and what the choice cost.
import { useEffect, useRef, useState } from "react";
import { ago, num, pct } from "@/lib/format";
import { Icon, Who } from "./ui";

const STEPS = [900, 1300, 1400, 3600]; // ms on each step: question, guess, decision, reveal

function offBy(guess, truth) {
  const t = Array.isArray(truth) ? truth.reduce((a, b) => (Math.abs(b - guess) < Math.abs(a - guess) ? b : a)) : truth;
  if (typeof guess !== "number" || typeof t !== "number" || !t) return null;
  const rel = Math.abs(guess - t) / Math.abs(t);
  return rel < 0.001 ? "spot on" : rel < 0.1 ? `off by ${(rel * 100).toFixed(1)}%` : `off by ${num(Math.abs(guess - t))}`;
}

function outcome(it, mistake) {
  switch (it.verdict) {
    case "overconfident": return { cls: "bad", icon: "x", label: "Overconfident", money: `−$${mistake.toFixed(2)}` };
    case "bought": return { cls: "good", icon: "check", label: "Right to buy", money: "−$0.01" };
    case "wasted": return { cls: "meh", icon: "minus", label: "Paid for what it knew", money: "−$0.01" };
    default: return { cls: "good", icon: "check", label: "Knew it", money: "$0.00" };
  }
}

export default function Replay({ items, mistakeCost, now }) {
  const [i, setI] = useState(0);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = useRef(false);

  useEffect(() => {
    still.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still.current) setStep(3);
  }, []);

  useEffect(() => {
    if (paused || !items.length) return;
    const t = setTimeout(() => {
      if (step < 3) setStep(step + 1);
      else { setI((i + 1) % items.length); setStep(still.current ? 3 : 0); }
    }, still.current ? 7000 : STEPS[step]);
    return () => clearTimeout(t);
  }, [i, step, paused, items.length]);

  if (!items.length) {
    return <div className="replay"><div className="replay-top"><span className="rec"><i />Replay</span></div>
      <div className="replay-q">The first round will appear here. Ask the models a question below to start.</div><div className="replay-body" /></div>;
  }
  const it = items[i];
  const o = outcome(it, mistakeCost);
  const truth = Array.isArray(it.truth) ? it.truth.map(num).join(" or ") : num(it.truth);
  const go = n => { setI((n + items.length) % items.length); setStep(3); setPaused(true); };
  const on = n => `rstep${step >= n ? " on" : ""}`;

  return (
    <div className="replay" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite">
      <div className="replay-top">
        <span className="rec"><i />Replay of a real decision</span>
        <span>{ago(it.at, now)}</span>
      </div>
      <div className="replay-q" key={`q${i}`}>{it.prompt}</div>
      <div className="replay-body">
        <div className={on(1)}>
          <Who model={it.model} />
          <div className="rguess" style={{ marginTop: 12 }}>
            <div><div className="lbl">Its own guess</div><div className="big">{step >= 1 ? num(it.guess) : "?"}<small>{it.unit}</small></div></div>
            {it.confidence !== null && it.confidence !== undefined && (
              <div className="rconf"><div className="lbl">Confidence {step >= 1 ? pct(it.confidence) : "?"}</div>
                <div className="conf"><i style={{ width: step >= 1 ? `${Math.round(it.confidence * 100)}%` : 0 }} /></div></div>
            )}
          </div>
        </div>
        <div className={on(2)}>
          <div className="rdec">
            <div className={it.decision === "answer" && step >= 2 ? "pick" : ""}><Icon name="cpu" />Answer from memory<b>$0</b></div>
            <div className={it.decision === "buy" && step >= 2 ? "pick buy" : ""}><Icon name="shield-check" />Buy on Telegraph<b>$0.01</b></div>
          </div>
          {it.why && <div className="rwhy" style={{ marginTop: 10 }}>{step >= 2 ? `“${it.why.slice(0, 140)}”` : "…"}</div>}
        </div>
        <div className={on(3)}>
          {step < 3 ? (
            <div className="rreveal wait"><div><div className="t">True answer</div><div className="tv faint">Checked after it commits…</div></div>
              <div className="verdict faint">?<span className="money">$?</span></div></div>
          ) : <div className={`rreveal ${o.cls}`}>
            <div>
              <div className="t">True answer · {it.truth_source}</div>
              <div className="tv">{truth} <span className="dim" style={{ fontFamily: "var(--sans)", fontSize: 13 }}>{it.unit}</span></div>
              <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                {it.decision === "buy" ? `Telegraph sold ${num(it.bought)}` : "Its guess was"} {offBy(it.decision === "buy" ? it.bought : it.guess, it.truth) || ""}
              </div>
            </div>
            <div className="verdict"><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name={o.icon} />{o.label}</span><span className="money">{o.money}</span></div>
          </div>}
        </div>
      </div>
      <div className="replay-foot">
        <button className="icon-btn" onClick={() => go(i - 1)} aria-label="Previous decision"><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chev" /></span></button>
        <div className="dots">{items.map((_, n) => <button key={n} className={n === i ? "on" : ""} onClick={() => go(n)} aria-label={`Decision ${n + 1}`} />)}</div>
        <a href={`#round-${it.round}`}>Open this round</a>
      </div>
    </div>
  );
}
