"use client";
// The Judgment API: what it answers, a live try-out (free preview), and how an agent calls the paid endpoint over x402.
import { useEffect, useState } from "react";
import { modelName, pct } from "@/lib/format";
import { ErrorNote, Icon } from "./ui";

const TOPICS = { crypto: "Crypto prices", fx: "Exchange rates", weather: "Weather", gas: "Ethereum gas", cve: "CVE severity" };

export default function JudgmentApi({ models, terms, site }) {
  const [model, setModel] = useState(models[0]);
  const [topic, setTopic] = useState("cve");
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("js");

  useEffect(() => {
    let live = true;
    setError("");
    fetch(`/api/advice/preview?model=${encodeURIComponent(model)}&topic=${topic}`).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      if (live) setRes(j);
    }).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [model, topic]);

  const url = `${site}${terms.path}?model=${model}&topic=${topic}`;
  const code = {
    js: `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "${terms.network}",
    client: new ExactEvmScheme(privateKeyToAccount(KEY)) }],
});

// Before trusting the model, ask Confidant (${terms.price}, paid automatically).
const r = await pay("${url}");
const { advice } = await r.json();      // "buy" or "answer"
if (advice === "buy") answer = await telegraph.ask(...);`,
    curl: `curl -i "${url}"

HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64>   # scheme "exact", ${terms.price} USDC
                             # on ${terms.network === "eip155:84532" ? "Base Sepolia" : terms.network}, payTo Confidant

# Pay with any x402 client, retry with the
# PAYMENT-SIGNATURE header, and get the advice.`,
    json: res ? JSON.stringify(Object.fromEntries(Object.entries(res).filter(([k]) => !["rounds", "updated_at"].includes(k))), null, 2) : "…",
  };

  return (
    <section id="api">
      <div className="shead"><div>
        <p className="kicker">For builders · Judgment API</p>
        <h2>Ask Confidant before your agent trusts a model</h2>
        <p className="sub">One call says whether a model's own answer on a topic is worth trusting, or worth paying Telegraph for, based on every graded decision so far. Agents pay {terms.price} per call over x402. Confidant buys intelligence and sells judgment.</p>
      </div></div>
      <div className="apigrid">
        <div className="apitry">
          <p className="step">Model</p>
          <select value={model} onChange={e => setModel(e.target.value)} aria-label="Model">
            {models.map(m => <option key={m} value={m}>{modelName(m).nice} · {modelName(m).maker}</option>)}
          </select>
          <p className="step" style={{ marginTop: 18 }}>Topic</p>
          <div className="chips">{Object.entries(TOPICS).map(([k, v]) => <button key={k} className="chip" aria-pressed={topic === k} onClick={() => setTopic(k)}>{v}</button>)}</div>
          {error ? <div style={{ marginTop: 18 }}><ErrorNote>{error}</ErrorNote></div> : res && (
            <div className={`verdictcard ${res.advice}`}>
              <div className="vtop"><span className="kicker" style={{ margin: 0 }}>Confidant says</span><span className="faint mono" style={{ fontSize: 12 }}>{res.confidence} confidence</span></div>
              <div className="vbig"><Icon name={res.advice === "buy" ? "shield-check" : "cpu"} size="lg" />{res.advice === "buy" ? "Buy on Telegraph" : "Trust the model"}</div>
              <p>{res.reason}</p>
              <div className="vcost">
                <div><small>Expected cost if it answers</small><b>${res.expected_cost_usd.answer.toFixed(3)}</b></div>
                <div><small>Expected cost if it buys</small><b>${res.expected_cost_usd.buy.toFixed(3)}</b></div>
                <div><small>Model right</small><b>{pct(res.model_accuracy)}</b></div>
              </div>
              <div className="faint" style={{ fontSize: 12 }}>Based on {res.based_on}.</div>
            </div>
          )}
        </div>
        <div className="apicode">
          <div className="tabs">
            {[["js", "JavaScript agent"], ["curl", "HTTP"], ["json", "Response"]].map(([k, v]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{v}</button>)}
            <span className="price-tag">{terms.price} / call</span>
          </div>
          <pre><code>{code[tab]}</code></pre>
          <div className="apifoot">
            <span><Icon name="shield-check" />x402 · USDC · settled by a facilitator, charged only on success</span>
            <a href="https://sepolia.basescan.org/tx/0xe218749bddc712dcb7cbecc76f6630d491df71da43c7db972bb9852bca71725d" target="_blank" rel="noopener">A real paid call <Icon name="ext" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
