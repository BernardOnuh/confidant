// Proof that the purchases are real: the latest answers bought on Telegraph, each with its public receipt.
import Link from "next/link";
import { ago, num } from "@/lib/format";
import { Icon, Who } from "./ui";

export default function Receipts({ receipts, telegraph, now, limit, more }) {
  if (limit) receipts = receipts.slice(0, limit);
  return (
    <section id="receipts">
      <div className="shead"><div>
        <p className="kicker">Proof of purchase</p>
        <h2>Every buy is a real payment</h2>
        <p className="sub">When a model buys, Confidant pays a Telegraph miner in test USDC over x402, machine to machine, and keeps the signed receipt. These are the latest.</p>
      </div></div>
      <div className="proof">
        <span><b>{telegraph.purchases.toLocaleString("en-US")}</b> answers bought</span>
        <span><b>${telegraph.spent_usd.toFixed(2)}</b> paid to miners</span>
        <span><b>{telegraph.purchases ? Math.round((telegraph.correct / telegraph.purchases) * 100) : 0}%</b> of bought answers correct</span>
      </div>
      <div className="receipts">
        <div className="rcpt head"><span>Buyer</span><span>Question · Intent</span><span>Answer</span><span>Paid</span><span /></div>
        {!receipts.length ? <div className="empty">No purchases yet.</div> : receipts.map((p, i) => (
          <div className="rcpt" key={i}>
            <Who model={p.model} />
            <div className="what"><div title={p.prompt}>{p.prompt}</div><small>{p.intent}{p.miner ? ` · ${p.miner}` : ""} · {ago(p.at, now)}</small></div>
            <span className="val">{num(p.value)} {p.correct === true ? <span className="good" title="Matched the independent truth">✓</span> : p.correct === false ? <span className="bad" title="Outside tolerance">✗</span> : null}</span>
            <span className="cost">${(p.cost_usd ?? 0.01).toFixed(2)}<small>{p.ms ? `${(p.ms / 1000).toFixed(1)} s` : "test USDC"}</small></span>
            {p.signal_url ? <a href={p.signal_url} target="_blank" rel="noopener">Receipt <Icon name="ext" /></a> : <span />}
          </div>
        ))}
      </div>
      {more && <div className="more-link"><Link href="/receipts">All receipts <Icon name="arrow" /></Link></div>}
    </section>
  );
}
