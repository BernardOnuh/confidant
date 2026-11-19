import Link from "next/link";

export default function NotFound() {
  return <main className="wrap page"><section><div className="empty"><h2>Not found</h2><p>That page or round doesn't exist. <Link href="/">Back to Confidant</Link></p></div></section></main>;
}
