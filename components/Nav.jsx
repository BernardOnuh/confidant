"use client";
// The top bar: brand, section links (the one in view is highlighted), GitHub, theme switch and the main action.
import { useEffect, useState } from "react";
import ThemeButton from "./ThemeButton";
import { Icon } from "./ui";

const LINKS = [["leaderboard", "Leaderboard"], ["value", "Savings"], ["try", "Try it"], ["api", "API"], ["receipts", "Receipts"], ["how", "Method"]];

export default function Nav({ repo }) {
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(es => {
      const seen = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const top = document.getElementById("top");
    const onScroll = () => { setScrolled(scrollY > 8); if (top && scrollY < top.offsetHeight * 0.5) setActive(""); };
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <nav className={scrolled ? "scrolled" : ""}>
      <div className="wrap">
        <a className="brand" href="#top"><svg className="logo" aria-hidden="true"><use href="#i-logo" /></svg>Confidant
          <span className="net"><span className="live" />Testnet</span></a>
        <div className="links">
          {LINKS.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? "on" : ""} aria-current={active === id ? "true" : undefined}>{label}</a>)}
        </div>
        <div className="nav-end">
          <a className="icon-btn" href={repo} target="_blank" rel="noopener" aria-label="Source code on GitHub" title="Source code">
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
          </a>
          <ThemeButton />
          <a className="btn primary nav-cta" href="#try">Ask live <Icon name="arrow" /></a>
        </div>
      </div>
    </nav>
  );
}
