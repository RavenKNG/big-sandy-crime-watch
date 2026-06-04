import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { RecordCard } from "@/components/RecordCard";
import { articles } from "@/lib/demo-data";
import { counties, countyDirectoryLabel, formatDate } from "@/lib/content";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED" },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
    take: 30,
  });
  const records = stored.map(storedRecordToDemoRecord);

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">BIG SANDY REGIONAL PUBLIC-SAFETY DESK</p>
        <h1>Big Sandy <span>Crime Watch.</span></h1>
        <p className="hero-kicker">Public booking updates from the Big Sandy region</p>
        <p>Updated throughout the day from public booking records. Free correction, hide, and de-index review requests are available.</p>
        <div className="button-row">
          <Link className="button" href="/today">Today&apos;s Bookings</Link>
          <Link className="secondary-button" href="/last-72-hours">Last 72 Hours</Link>
          <Link className="secondary-button" href="/category/bookings">Booking Archive</Link>
          <Link className="secondary-button" href="/correction-request">Request a correction</Link>
        </div>
        <div className="filter-row">
          {counties.map((county: (typeof counties)[number]) => (
            <Link className="pill" href={`/county/${county}`} key={county}>
              {countyDirectoryLabel(county)}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div><p className="eyebrow">LATEST UPDATES</p><h2>Public-safety news</h2></div>
          <Link href="/category/public-safety">Browse updates</Link>
        </div>
        <div className="article-grid">
          {articles.map((article: (typeof articles)[number]) => <article className="news-card" key={article.slug}><p className="eyebrow">{article.category} - {formatDate(article.publishedAt)}</p><h3>{article.title}</h3><p>{article.summary}</p><Link href={`/news/${article.slug}`}>Read update</Link></article>)}
        </div>
      </section>
      <section id="latest-records">
        <div className="section-heading">
          <div><p className="eyebrow">LATEST PUBLIC RECORDS</p><h2>Latest Big Sandy Regional Bookings</h2></div>
          <Link href="/category/bookings">Browse bookings</Link>
        </div>
        {records.length === 0 ? <p>No published booking records are available.</p> : <div className="record-grid">{records.map((record: (typeof records)[number], index: number) => <div key={record.slug}><RecordCard record={record} />{index === 5 && <AdSlot placement="in-feed" />}</div>)}</div>}
      </section>
      <AdSlot placement="homepage-lower" />
      <section className="content-card source-directory">
        <p className="eyebrow">COUNTY LOOKUP DIRECTORY</p>
        <h2>County and source access</h2>
        <p>
          Browse county pages for published records and public-source guidance, including the
          Rowan County Detention Center inmate lookup page.
        </p>
        <div className="filter-row">
          {counties.map((county: (typeof counties)[number]) => (
            <Link className="pill" href={`/county/${county}`} key={`directory-${county}`}>
              {countyDirectoryLabel(county)}
            </Link>
          ))}
        </div>
      </section>
      <p className="policy-links"><Link href="/disclaimer">Disclaimer</Link> | <Link href="/correction-request">Correction requests</Link> | <Link href="/privacy">Privacy</Link> | <Link href="/admin">Admin sign-in</Link></p>
    </main>
  );
}
