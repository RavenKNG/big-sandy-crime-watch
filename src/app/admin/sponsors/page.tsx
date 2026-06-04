import { saveSponsor } from "@/app/actions";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const sponsors = await getDb().sponsorAd.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <section className="content-card">
        <p className="eyebrow">SPONSOR CONFIGURATION</p>
        <h1>Local sponsor slots</h1>
        <p>
          Saved sponsors remain disabled until explicitly activated in a later review.
          Public sponsor display remains off while <code>ADS_ENABLED=false</code>.
        </p>

        <form action={saveSponsor}>
          <label>
            Sponsor name
            <input name="name" required />
          </label>
          <label>
            Placement
            <select name="placement">
              <option>mobile-top-banner</option>
              <option>in-feed</option>
              <option>detail-top</option>
              <option>footer</option>
            </select>
          </label>
          <label>
            Image URL or path
            <input name="imageUrl" />
          </label>
          <label>
            Target URL
            <input name="url" type="url" />
          </label>
          <label>
            Short text
            <input name="text" />
          </label>
          <button type="submit">Save disabled sponsor</button>
        </form>

        <h2>Saved sponsor placeholders</h2>
        {sponsors.length === 0 ? (
          <p>No sponsor placeholders saved.</p>
        ) : (
          sponsors.map((sponsor: (typeof sponsors)[number]) => (
            <div className="admin-card" key={sponsor.id}>
              <strong>{sponsor.name}</strong>
              <p>
                {sponsor.placement} -{" "}
                <span className="pill">{sponsor.enabled ? "enabled" : "disabled"}</span>
              </p>
              {sponsor.text ? <p>{sponsor.text}</p> : null}
              {sponsor.imageUrl ? <p>Image: {sponsor.imageUrl}</p> : null}
              {sponsor.linkUrl ? <p>Target: {sponsor.linkUrl}</p> : null}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
