import Rounds from "@/components/Rounds";
import { loadRounds } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Past rounds", description: "Every round: each model's guess, confidence, decision, purchase receipt and grade." };

export default async function Page() {
  return <main className="wrap page"><Rounds initial={await loadRounds(21)} now={Date.now()} /></main>;
}
