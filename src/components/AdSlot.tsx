import Link from "next/link";

export function AdSlot({ placement }: { placement: string }) {
  return (
    <aside className="ad-slot" aria-label={`${placement} sponsor placement`}>
      <small>Sponsored</small>
      <strong>Advertise With Big Sandy Crime Watch</strong>
      <span>Reach local readers across Eastern Kentucky.</span>
      <Link href="/contact">Sponsor This Space</Link>
    </aside>
  );
}
