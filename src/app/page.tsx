import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { RecordCard } from "@/components/RecordCard";
import { articles } from "@/lib/demo-data";
import { formatDate } from "@/lib/content";
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
        <p className="eyebrow">BIG SANDY AREA PUBLIC-SAFETY DESK</p>
        <h1>Local records. <span>Clear context.</span></h1>
        <p>Carefully attributed public booking records with free correction, hide, and de-index review requests.</p>
        <div className="button-row">
          <Link className="button" href="/today">Today&apos;s Arrests</Link>
          <Link className="secondary-button" href="#latest-records">Latest Public Records</Link>
          <Link className="secondary-button" href="/correction-request">Request a correction</Link>
        </div>
      </section>
      <AdSlot placement="mobile-top-banner" />
      <section>
        <div className="section-heading">
          <div><p className="eyebrow">LATEST UPDATES</p><h2>Public-safety news</h2></div>
          <Link href="/category/public-safety">Browse updates</Link>
        </div>
        <div className="article-grid">
          {articles.map((article) => <article className="news-card" key={article.slug}><p className="eyebrow">{article.category} - {formatDate(article.publishedAt)}</p><h3>{article.title}</h3><p>{article.summary}</p><Link href={`/news/${article.slug}`}>Read update</Link></article>)}
        </div>
      </section>
      <section id="latest-records">
        <div className="section-heading">
          <div><p className="eyebrow">LATEST PUBLIC RECORDS</p><h2>Recent bookings</h2></div>
          <Link href="/category/bookings">Browse bookings</Link>
        </div>
        {records.length === 0 ? <p>No published booking records are available.</p> : <div className="record-grid">{records.map((record, index) => <div key={record.slug}><RecordCard record={record} />{index === 0 && <AdSlot placement="in-feed" />}</div>)}</div>}
      </section>
      <p className="policy-links"><Link href="/disclaimer">Disclaimer</Link> · <Link href="/correction-request">Correction requests</Link> · <Link href="/privacy">Privacy</Link></p>
    </main>
  );
}
