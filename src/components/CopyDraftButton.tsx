"use client";

export function CopyDraftButton({ text }: { text: string }) {
  return <button type="button" onClick={() => void navigator.clipboard.writeText(text)}>Copy text</button>;
}
