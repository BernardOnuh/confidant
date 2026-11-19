"use client";
// Light/dark switch. The choice is remembered; the first visit follows the device setting (see the script in layout.jsx).
export default function ThemeButton() {
  const flip = () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  };
  return (
    <button className="icon-btn" onClick={flip} title="Switch light / dark" aria-label="Switch light or dark theme">
      <svg className="i i-sun" aria-hidden="true"><use href="#i-sun" /></svg><svg className="i i-moon" aria-hidden="true"><use href="#i-moon" /></svg>
    </button>
  );
}
