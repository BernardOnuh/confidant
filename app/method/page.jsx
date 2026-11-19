import Link from "next/link";
import { Icon } from "@/components/ui";
import { config } from "@/src/config.mjs";

export const metadata = { title: "Method", description: "How Confidant asks, lets models decide, buys on Telegraph, and grades against independent truth." };

export default function Page() {
  const mc = `$${config.mistakeCostUsd.toFixed(2)}`;
  return (
    <main className="wrap page">
      <section id="how">
        <div className="shead"><div><p className="kicker">Method</p><h2>How it works</h2><p className="sub">Every model receives the same questions, the same prompt and the same prices. This is the choice each one faces:</p></div></div>
        <div className="choice" aria-label="The choice every model faces" style={{ marginBottom: 16 }}>
          <div className="opt">
            <span className="ic"><Icon name="cpu" size="lg" /></span>
            <h3>Answer from memory</h3>
            <p>Free, but a wrong answer costs its principal {mc}.</p>
            <div className="price">$0.00<small>or −{mc} if wrong</small></div>
          </div>
          <div className="opt">
            <span className="ic"><Icon name="shield-check" size="lg" /></span>
            <h3>Buy a verified answer</h3>
            <p>A real payment on the <a href="https://telegraphprotocol.com" target="_blank" rel="noopener">Telegraph</a> network, with a public receipt.</p>
            <div className="price">$0.01<small>per answer</small></div>
          </div>
        </div>
        <div className="how">
          <div><span className="n">01</span><h3>Ask</h3><p>Each round mixes live facts no model can remember (prices, exchange rates, weather, gas, newly published vulnerabilities) with facts some models do know.</p></div>
          <div><span className="n">02</span><h3>Decide</h3><p>Each model gives its best guess, its confidence, and a decision: answer itself, or buy.</p></div>
          <div><span className="n">03</span><h3>Buy</h3><p>A buy is a real machine-to-machine payment on Telegraph testnet, in USDC over x402, with a verifiable receipt.</p></div>
          <div><span className="n">04</span><h3>Grade</h3><p>Once every model has committed, the true answer is fetched from independent sources and every decision is scored.</p></div>
        </div>
        <div className="faq">
          <details><summary>Why does a wrong answer cost {mc}?<Icon name="plus" size="" /></summary><p>An AI agent acting for someone spends their money. A confident wrong answer, such as a stale price, causes real losses. The penalty puts a price on that, so a model that guesses blindly cannot win by being cheap.</p></details>
          <details><summary>Is the money real?<Icon name="plus" size="" /></summary><p>Purchases are real x402 payments on Telegraph's testnet, settled in test USDC. They are genuine machine-to-machine transactions with verifiable receipts; no mainnet funds are spent.</p></details>
          <details><summary>Where does the true answer come from?<Icon name="plus" size="" /></summary><p>From sources independent of Telegraph: Coinbase and CoinGecko for prices, ExchangeRate-API and the ECB for currencies, Open-Meteo and MET Norway for weather, the NIST National Vulnerability Database for CVEs, and public Ethereum nodes for gas. If none respond, the question is discarded rather than guessed.</p></details>
          <details><summary>How does Confidant earn?<Icon name="plus" size="" /></summary><p>It sells what it learns. The <Link href="/developers">Judgment API</Link> tells an agent, for $0.002 over x402, whether a given model is worth trusting on a topic or whether it should buy a verified answer instead.</p></details>
          <details><summary>Can I inspect the code or run it myself?<Icon name="plus" size="" /></summary><p>Yes. The project is <a href="https://github.com/BernardOnuh/confidant" target="_blank" rel="noopener">open source</a>, including the exact prompt every model receives, so anyone can review or challenge it.</p></details>
        </div>
      </section>
    </main>
  );
}
