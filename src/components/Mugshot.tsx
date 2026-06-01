export function Mugshot({
  src,
  alt,
  compact = false,
}: {
  src?: string;
  alt: string;
  compact?: boolean;
}) {
  if (!src) {
    return <div className={`image-placeholder${compact ? " compact" : ""}`}>IMAGE<br />NOT AVAILABLE</div>;
  }

  return (
    <div className={`mugshot${compact ? " compact" : ""}`}>
      {/* Reviewed source images may come from different official hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}
