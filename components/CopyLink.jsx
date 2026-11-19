"use client";
// Copies this page's address.
import { useState } from "react";
import { Icon } from "./ui";

export default function CopyLink({ label = "Copy link" }) {
  const [done, setDone] = useState(false);
  const copy = () => navigator.clipboard?.writeText(location.href).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
  return <button className="toggle" onClick={copy}><Icon name="link" />{done ? "Link copied" : label}</button>;
}
