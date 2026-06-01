type Sponsor = {
  name: string;
  message?: string;
  logoUrl?: string;
  url?: string;
};

export function LocalSponsorSlot({ sponsor }: { sponsor?: Sponsor }) {
  if (!sponsor) return null;
  return (
    <aside className="local-sponsor" aria-label="Sponsored">
      <small>Sponsored</small>
      {/* Sponsor logos are optional config-driven assets that may use external hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sponsor.logoUrl && <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} loading="lazy" />}
      <strong>{sponsor.name}</strong>
      {sponsor.message && <span>{sponsor.message}</span>}
      {sponsor.url && <a href={sponsor.url} rel="sponsored noopener" target="_blank">Visit sponsor</a>}
    </aside>
  );
}
