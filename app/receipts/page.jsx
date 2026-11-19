import Receipts from "@/components/Receipts";
import { loadShowcase, loadSummary } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipts", description: "Every answer a model bought on Telegraph, paid machine to machine over x402, with its receipt." };

export default async function Page() {
  const [s, show] = await Promise.all([loadSummary(), loadShowcase()]);
  return <main className="wrap page"><Receipts receipts={show.receipts} telegraph={s.telegraph} now={Date.now()} /></main>;
}
