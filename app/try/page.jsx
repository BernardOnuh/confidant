import TryIt from "@/components/TryIt";
import { loadOptions } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Try it live", description: "Ask the models a question and watch each one decide whether to trust its memory or pay Telegraph." };

export default async function Page() {
  return <main className="wrap page"><TryIt options={await loadOptions()} /></main>;
}
