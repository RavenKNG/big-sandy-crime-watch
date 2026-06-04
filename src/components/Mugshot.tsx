import { publicMugshotPath } from "@/lib/mugshot-public";

export function Mugshot({
  src,
  alt,
  compact = false,
}: {
  src?: string;
  alt: string;
  compact?: boolean;
}) {
  return (
    <div className={`mugshot${compact ? " compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={publicMugshotPath(src)} alt={alt} loading="lazy" />
    </div>
  );
}
