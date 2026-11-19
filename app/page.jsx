// Home: the question, a live replay of real decisions, the headline numbers, and a preview of every page.
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { Podium } from "@/components/Leaderboard";
import Receipts from "@/components/Receipts";
import Replay from "@/components/Replay";
import { SavingsHeadline } from "@/components/Savings";
import Stats from "@/components/Stats";
import { Icon } from "@/components/ui";
import { loadOptions, loadSavings, loadShowcase, loadSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [opts, summary, show, value] = await Promise.all([loadOptions(), loadSummary(), loadShowcase(), loadSavings()]);
  const mc = `$${summary.mistake_cost_usd.toFixed(2)}`, now = Date.now(), n = opts.models.length;
  return (
    <>
      <AutoRefresh />
      <header className="hero">
        <div className="hero-bg" />
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="eyebrow"><span className="live" />Live benchmark · Telegraph testnet</span>
              <h1>Which AI knows when it <em>doesn't</em> know?</h1>
              <p className="lede">{n === 8 ? "Eight" : n} AI models get real-world questions: today's Bitcoin price, the temperature in Lagos, a vulnerability's severity. Each must choose: trust its memory for free, or pay $0.01 on Telegraph for a verified answer. A confident wrong answer costs {mc}. We grade who chose well.</p>
              <div className="cta">
                <Link className="btn primary" href="/try">Ask the models a question <Icon name="arrow" /></Link>
                <Link className="btn ghost" href="/leaderboard">See who's winning</Link>
              </div>
              <div className="trust">
                <span><Icon name="cpu" />{n} frontier models</span>
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
        <section>
          <div className="shead">
            <div><p className="kicker">Leaderboard</p><h2>Ranked by judgment</h2>
              <p className="sub">Not who knows the most, but who knows when to ask: paying only when its own answer would have been wrong.</p></div>
            <Link className="toggle" href="/leaderboard">Full leaderboard <Icon name="arrow" /></Link>
          </div>
          {summary.leaderboard.length ? <div className="podium">{summary.leaderboard.slice(0, 3).map((r, i) => <Podium key={r.model} r={r} place={i} />)}</div>
            : <div className="empty">No rounds yet. <Link href="/try">Ask the first question.</Link></div>}
        </section>

        {value?.decisions > 0 && (
          <section>
            <div className="shead">
              <div><p className="kicker">What judgment is worth</p><h2>Following Confidant: {value.headline.vs_never_pct}% cheaper than trusting the model</h2>
                <p className="sub">{value.decisions} real decisions replayed under five strategies, at $0.01 a purchase and {mc} a mistake.</p></div>
              <Link className="toggle" href="/savings">All five strategies <Icon name="arrow" /></Link>
            </div>
            <SavingsHeadline s={value} />
          </section>
        )}

        <section>
          <div className="cards2">
            <Link href="/try" className="bigcard">
              <span className="kicker">Try it live</span>
              <h3>Put a question to the models</h3>
              <p>Watch each model guess, decide whether to pay, and get graded against the real world, live.</p>
              <span className="go">Ask a question <Icon name="arrow" /></span>
            </Link>
            <Link href="/developers" className="bigcard gold">
              <span className="kicker">For builders · Judgment API</span>
              <h3>Ask Confidant before your agent trusts a model</h3>
              <p>One call, $0.002 over x402: should this model answer, or should your agent buy a verified answer?</p>
              <span className="go">See the API <Icon name="arrow" /></span>
            </Link>
          </div>
        </section>

        <Receipts receipts={show.receipts} telegraph={summary.telegraph} now={now} limit={4} more />
      </main>
    </>
  );
}
