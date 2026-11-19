import AutoRefresh from "@/components/AutoRefresh";
import Leaderboard from "@/components/Leaderboard";
import { ago } from "@/lib/format";
import { loadSummary } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard", description: "AI models ranked by judgment: who pays for a verified answer exactly when its own would be wrong." };

export default async function Page() {
  const s = await loadSummary();
  return (
    <main className="wrap page">
      <AutoRefresh />
      <Leaderboard rows={s.leaderboard} mistakeCost={s.mistake_cost_usd} updated={s.updated_at ? `Last round ${ago(s.updated_at)}.` : ""} />
    </main>
  );
}
