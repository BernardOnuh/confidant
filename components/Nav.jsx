"use client";
// The top bar: brand, page links (the current page is highlighted), GitHub, theme switch and the main action.
// On phones the links fold into a menu that opens over the page.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeButton from "./ThemeButton";
import { Icon } from "./ui";

const LINKS = [
  ["/leaderboard", "Leaderboard", "Models ranked by judgment"],
  ["/savings", "Savings", "What judgment is worth"],
  ["/try", "Try it", "Ask the models live"],
  ["/developers", "API", "The paid Judgment API"],
  ["/receipts", "Receipts", "Every Telegraph purchase"],
  ["/rounds", "Rounds", "Every round, decision by decision"],
  ["/method", "Method", "How it works"],
];

const GitHub = () => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
);

export default function Nav({ repo }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 8);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = e => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  const on = href => path === href || path.startsWith(href + "/");

  return (
    <>
    <nav className={`${scrolled ? "scrolled" : ""} ${open ? "menu-open" : ""}`}>
      <div className="wrap">
        <Link className="brand" href="/"><svg className="logo" aria-hidden="true"><use href="#i-logo" /></svg>Confidant
          <span className="net"><span className="live" />Testnet</span></Link>
        <div className="links">
          {LINKS.map(([href, label]) => <Link key={href} href={href} className={on(href) ? "on" : ""} aria-current={on(href) ? "page" : undefined}>{label}</Link>)}
        </div>
        <div className="nav-end">
          <a className="icon-btn wide-only" href={repo} target="_blank" rel="noopener" aria-label="Source code on GitHub" title="Source code"><GitHub /></a>
          <span className="wide-only"><ThemeButton /></span>
          {path !== "/try" && <Link className="btn primary nav-cta" href="/try">Ask live <Icon name="arrow" /></Link>}
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu">
            {open ? <Icon name="x" /> : <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
          </button>
        </div>
      </div>
    </nav>
    {/* Outside <nav>: the bar's blur would otherwise trap this fixed panel inside the bar. */}
      {open && (
        <div className="mnav" id="mobile-menu">
          <div className="wrap">
            <ul>
              <li><Link href="/" className={path === "/" ? "on" : ""}><b>Home</b><small>The live replay and the headline numbers</small></Link></li>
              {LINKS.map(([href, label, hint]) => (
                <li key={href}><Link href={href} className={on(href) ? "on" : ""}><b>{label}</b><small>{hint}</small><Icon name="chev" /></Link></li>
              ))}
            </ul>
            <div className="mnav-foot">
              <a className="toggle" href={repo} target="_blank" rel="noopener"><GitHub />Source code</a>
              <span className="mnav-theme"><span className="faint">Theme</span><ThemeButton /></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
