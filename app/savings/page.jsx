import Savings from "@/components/Savings";
import { loadSavings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "What judgment is worth", description: "Real decisions replayed under five strategies: trust the model, always buy, follow Confidant, and more." };

export default async function Page() {
  return <main className="wrap page"><Savings s={await loadSavings()} /></main>;
}
