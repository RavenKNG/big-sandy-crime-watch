import { RecordCard } from "@/components/RecordCard";
import { AdSlot } from "@/components/AdSlot";
import Link from "next/link";
import { articles } from "@/lib/demo-data";
import { categorize } from "@/lib/content";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const category = (await params).category;
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED" },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord).filter((record) => categorize(record).includes(category));
  const news = articles.filter((article) => article.category === category);

  return <main><p className="eyebrow">CATEGORY</p><h1>{category === "bookings" ? "Big Sandy Regional Booking Archive" : category.replaceAll("-", " ")}</h1><p>{records.length} published {records.length===1?"record":"records"}, listed newest first with county details available on each record page.</p>{category==="bookings"&&<div className="button-row"><Link className="secondary-button" href="/search">Search and filter records</Link><Link className="secondary-button" href="/today">Today&apos;s bookings</Link></div>}<div className="article-grid">{news.map((article) => <article className="news-card" key={article.slug}><h3>{article.title}</h3><p>{article.summary}</p></article>)}</div>{records.length === 0 ? <p>No published records are available in this category.</p> : <div className="record-grid">{records.map((record,index) => <div key={record.slug}><RecordCard record={record} />{index===7&&<AdSlot placement="in-feed"/>}</div>)}</div>}</main>;
}
