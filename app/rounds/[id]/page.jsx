// One round on its own page, so it can be linked and shared.
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyLink from "@/components/CopyLink";
import QuestionCard from "@/components/QuestionCard";
import { Icon } from "@/components/ui";
import { plural } from "@/lib/format";
import { loadRound } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const r = await loadRound((await params).id);
  if (!r) return { title: "Round not found" };
  const q = r.questions.filter(x => !x.void);
  return { title: r.source === "visitor" ? q[0]?.prompt || "Visitor question" : `Round of ${plural(q.length, "question")}`,
    description: `${r.models.length} AI models decide whether to trust their memory or buy a verified answer on Telegraph.` };
}

export default async function Page({ params }) {
  const r = await loadRound((await params).id);
  if (!r) notFound();
  const qs = r.questions.filter(q => !q.void);
  const es = qs.flatMap(q => q.entries.filter(e => !e.error));
  const when = new Date(r.started_at).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <main className="wrap page">
      <section>
        <Link href="/rounds" className="back"><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chev" /></span>All rounds</Link>
        <div className="shead"><div>
          <p className="kicker">{r.source === "visitor" ? "Visitor question" : "Scheduled round"} · {when} UTC</p>
          <h2>{r.source === "visitor" ? qs[0]?.prompt : `${plural(qs.length, "question")}, ${r.models.length} models`}</h2>
          <p className="sub">
            <b>{es.filter(e => e.good_call).length}/{es.length}</b> correct decisions · <b>{es.filter(e => e.decision === "buy").length}</b> bought on Telegraph · <b>{es.filter(e => e.overconfident).length}</b> overconfident
          </p>
        </div><CopyLink label="Copy link to this round" /></div>
        {r.questions.map(q => <QuestionCard key={q.id} q={q} />)}
      </section>
    </main>
  );
}
