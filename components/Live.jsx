"use client";
// The parts of the page that change: the headline numbers, the leaderboard, the try box and the round list.
// They start from what the server rendered and refresh after a visitor's question and every minute.
import { useCallback, useEffect, useState } from "react";
import { ago, pct } from "@/lib/format";
import JudgmentApi from "./JudgmentApi";
import Leaderboard from "./Leaderboard";
import Savings from "./Savings";
import Receipts from "./Receipts";
import Replay from "./Replay";
import Rounds from "./Rounds";
import TryIt from "./TryIt";
import { Icon } from "./ui";

const get = path => fetch(path, { cache: "no-store" }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))));

export function Stats({ summary: s }) {
  return (
    <div className="stats">
      <div className="stat"><b>{s.rounds.toLocaleString("en-US")}</b><span>Rounds played</span></div>
      <div className="stat"><b>{s.decisions.toLocaleString("en-US")}</b><span>Decisions graded</span></div>
      <div className="stat"><b>{s.telegraph.purchases.toLocaleString("en-US")}</b><span>Answers bought on Telegraph</span></div>
      <div className="stat"><b className="gold">{s.telegraph.purchases ? pct(s.telegraph.correct / s.telegraph.purchases) : "–"}</b><span>Bought answers correct</span></div>
    </div>
  );
}

export default function Live({ initial, hero, children }) {
  const [summary, setSummary] = useState(initial.summary);
  const [rounds, setRounds] = useState(initial.rounds);
  const [limit, setLimit] = useState(10);
  const [show, setShow] = useState(initial.showcase);
  const [value, setValue] = useState(initial.savings);
  const [now, setNow] = useState(initial.now);

  const refresh = useCallback(async (n = limit) => {
    const [s, r, sc, v] = await Promise.all([get("/api/summary"), get(`/api/rounds?limit=${n + 1}`), get("/api/showcase"), get("/api/savings")]).catch(() => []);
    if (v) setValue(v);
    if (s) setSummary(s);
    if (r) setRounds(r);
    if (sc) setShow(sc);
    setNow(Date.now());
  }, [limit]);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const mock = initial.options.models.every(m => m.startsWith("mock/"));
  return (
    <>
      {mock && <div className="banner"><div className="wrap"><span><b>Demo mode.</b> Three simulated models and a simulated Telegraph miner. No real model calls or payments are made.</span></div></div>}
      <header id="top" className="hero">
        <div className="hero-bg" />
        <div className="wrap">
          <div className="hero-grid">
            <div>
              {hero}
              <div className="trust">
                <span><Icon name="cpu" />{initial.options.models.length} frontier models</span>
                <span><Icon name="shield-check" />Real x402 payments</span>
                <span><Icon name="check" />Graded against Coinbase, ECB, NIST</span>
              </div>
            </div>
            <Replay items={show.replay} mistakeCost={summary.mistake_cost_usd} now={now} />
          </div>
          <Stats summary={summary} />
        </div>
      </header>
      <main className="wrap">
        <Leaderboard rows={summary.leaderboard} mistakeCost={summary.mistake_cost_usd}
          updated={summary.updated_at ? `Last round ${ago(summary.updated_at, now)}.` : ""} />
        <Savings s={value} />
        <TryIt options={initial.options} onDone={() => refresh()} />
        <JudgmentApi models={initial.options.models} terms={initial.terms} site={initial.site} />
        <Receipts receipts={show.receipts} telegraph={summary.telegraph} now={now} />
        <Rounds rounds={rounds.slice(0, limit)} now={now} more={rounds.length > limit && limit < 50}
          onMore={() => { const n = limit + 10; setLimit(n); refresh(n); }} />
        {children}
      </main>
    </>
  );
}
