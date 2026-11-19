// Small pieces used across the page: icons, model identity, status labels.
import { modelName } from "@/lib/format";

export const Icon = ({ name, size = "sm" }) => <svg className={`i ${size}`} aria-hidden="true"><use href={`#i-${name}`} /></svg>;

export function Who({ model }) {
  const { nice, maker, initials } = modelName(model);
  return (
    <div className="who">
      <span className="av">{initials}</span>
      <div style={{ minWidth: 0 }}><div className="n" title={model}>{nice}</div><div className="o">{maker}</div></div>
    </div>
  );
}

export function Profile({ r }) {
  if (r.questions < 3) return <span className="st">Insufficient data</span>;
  if (r.overconfident / r.questions >= 0.25) return <span className="st bad">Overconfident</span>;
  if (r.wasted_buys / r.questions >= 0.3) return <span className="st buy">Over-cautious</span>;
  if (r.judgment >= 0.7) return <span className="st good">Well calibrated</span>;
  return <span className="st accent">Mixed</span>;
}

export const ErrorNote = ({ children }) => <div className="note"><Icon name="alert" /><span>{children}</span></div>;

// The line icons, drawn once and referenced by id.
export const Sprite = () => (
  <svg className="sprite" width="0" height="0" aria-hidden="true">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCE38A" /><stop offset=".45" stopColor="#E9B949" /><stop offset="1" stopColor="#B07D1E" /></linearGradient></defs>
    <symbol id="i-logo" viewBox="0 0 24 24"><path d="M18.13 6.86A8 8 0 1 0 18.13 17.14" fill="none" stroke="url(#gold)" strokeWidth="2.6" strokeLinecap="round" /><circle cx="19.6" cy="12" r="1.7" stroke="none" fill="currentColor" /></symbol>
    <symbol id="i-cpu" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></symbol>
    <symbol id="i-shield-check" viewBox="0 0 24 24"><path d="M12 21.5s7.5-3.6 7.5-9.4V5.6L12 2.8 4.5 5.6v6.5c0 5.8 7.5 9.4 7.5 9.4z" /><path d="m9 12 2.2 2.2L15.5 10" /></symbol>
    <symbol id="i-coins" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6" /><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7" /><path d="M8 7h1.5v4" /></symbol>
    <symbol id="i-swap" viewBox="0 0 24 24"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" /></symbol>
    <symbol id="i-thermo" viewBox="0 0 24 24"><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z" /></symbol>
    <symbol id="i-flame" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></symbol>
    <symbol id="i-shield-alert" viewBox="0 0 24 24"><path d="M12 21.5s7.5-3.6 7.5-9.4V5.6L12 2.8 4.5 5.6v6.5c0 5.8 7.5 9.4 7.5 9.4z" /><path d="M12 8v4.5M12 16h.01" /></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></symbol>
    <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" /></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
    <symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
    <symbol id="i-ext" viewBox="0 0 24 24"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" /><path d="M12 16v-4.5M12 8h.01" /></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" /></symbol>
    <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></symbol>
  </svg>
);
