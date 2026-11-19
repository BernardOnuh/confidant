// The Confidant site. Rendered on the server with the latest results, then kept up to date in the browser.
import { getSummary, listRounds, options, showcase } from "@/src/api.mjs";
import Live from "@/components/Live";
import Nav from "@/components/Nav";
import { Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

const EMPTY = { rounds: 0, questions: 0, decisions: 0, leaderboard: [], telegraph: { purchases: 0, spent_usd: 0, correct: 0 }, mistake_cost_usd: 0.25, updated_at: null };

export default async function Page() {
  const [[, opts], summary, rounds, show] = await Promise.all([
    options(),
    getSummary().then(([, s]) => s).catch(e => (console.error("summary:", e.message), EMPTY)),
    listRounds(11).then(([, r]) => r).catch(e => (console.error("rounds:", e.message), [])),
    showcase().then(([, s]) => s).catch(e => (console.error("showcase:", e.message), { replay: [], receipts: [] })),
  ]);
  const mc = `$${summary.mistake_cost_usd.toFixed(2)}`;

  const hero = (
    <>
      <span className="eyebrow"><span className="live" />Live benchmark · Telegraph testnet</span>
      <h1>Which AI knows when it <em>doesn't</em> know?</h1>
      <p className="lede">{opts.models.length === 8 ? "Eight" : opts.models.length} AI models get real-world questions: today's Bitcoin price, the temperature in Lagos, a vulnerability's severity. Each must choose: trust its memory for free, or pay $0.01 on Telegraph for a verified answer. A confident wrong answer costs {mc}. We grade who chose well.</p>
      <div className="cta">
        <a className="btn primary" href="#try">Ask the models a question <Icon name="arrow" /></a>
        <a className="btn ghost" href="#leaderboard">See who's winning</a>
      </div>
    </>
  );

  const choice = (
    <>
      <div className="choice" aria-label="The choice every model faces">
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
    </>
  );

  return (
    <>
      <Nav repo="https://github.com/BernardOnuh/confidant" />

      <Live initial={{ summary, rounds, options: opts, showcase: show, now: Date.now() }} hero={hero}>
        <section id="how">
          <div className="shead"><div><p className="kicker">Method</p><h2>How it works</h2><p className="sub">Every model receives the same questions, the same prompt and the same prices. This is the choice each one faces:</p></div></div>
          <div style={{ marginBottom: 16 }}>{choice}</div>
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
            <details><summary>Can I inspect the code or run it myself?<Icon name="plus" size="" /></summary><p>Yes. The project is <a href="https://github.com/BernardOnuh/confidant" target="_blank" rel="noopener">open source</a>, including the exact prompt every model receives, so anyone can review or challenge it.</p></details>
          </div>
        </section>
      </Live>

      <footer>
        <div className="wrap">
          <span>Confidant · Telegraph Hackathon Season II · Purchases run on testnet</span>
          <a href="https://github.com/BernardOnuh/confidant" target="_blank" rel="noopener">Source code</a>
        </div>
      </footer>
    </>
  );
}
