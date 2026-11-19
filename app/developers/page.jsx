import JudgmentApi from "@/components/JudgmentApi";
import { adviceTerms, loadOptions, siteUrl } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Judgment API", description: "Ask Confidant before your agent trusts a model: $0.002 per call over x402." };

const ENDPOINTS = [
  ["GET", "/api/advice?model=&topic=", "Should this model answer or buy on this topic?", "$0.002 via x402"],
  ["GET", "/api/advice/preview?model=&topic=", "The same advice, for trying it out", "Free, limited"],
  ["POST", "/api/try", "Run a live question; streams each decision, purchase and grade (NDJSON)", "Free, limited"],
  ["GET", "/api/summary", "Leaderboard and totals", "Free"],
  ["GET", "/api/savings", "The five-strategy replay", "Free"],
  ["GET", "/api/rounds?limit=20", "Past rounds, newest first", "Free"],
  ["GET", "/api/rounds/{id}", "One round in full, with receipts", "Free"],
  ["GET", "/api/showcase", "Replay examples and the latest receipts", "Free"],
  ["GET", "/api/options", "Topics, subjects and models", "Free"],
];

export default async function Page() {
  const opts = await loadOptions();
  return (
    <main className="wrap page">
      <JudgmentApi models={opts.models} terms={adviceTerms()} site={siteUrl} />
      <section id="endpoints">
        <div className="shead"><div><p className="kicker">Reference</p><h2>All endpoints</h2><p className="sub">JSON over HTTPS. Topics: crypto, fx, weather, gas, cve. Models: any OpenRouter id.</p></div></div>
        <div className="tablewrap">
          <table className="endpoints">
            <thead><tr><th className="l">Method</th><th className="l">Path</th><th className="l">What it does</th><th>Price</th></tr></thead>
            <tbody>{ENDPOINTS.map(([m, p, d, c]) => (
              <tr key={p}><td className="l"><span className={`verb ${m.toLowerCase()}`}>{m}</span></td><td className="l mono">{p}</td><td className="l">{d}</td><td className={c.startsWith("$") ? "gold" : "faint"}>{c}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
