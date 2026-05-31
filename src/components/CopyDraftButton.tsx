"use client";

import { useState } from "react";

export function CopyDraftButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }}>{copied ? "Copied" : label}</button>;
}
