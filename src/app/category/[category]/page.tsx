import { RecordCard } from "@/components/RecordCard";
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

  return <main><p className="eyebrow">CATEGORY</p><h1>{category === "bookings" ? "Big Sandy Regional Bookings" : category.replaceAll("-", " ")}</h1><p>Published records are listed newest first with county details available on each record page.</p><div className="article-grid">{news.map((article) => <article className="news-card" key={article.slug}><h3>{article.title}</h3><p>{article.summary}</p></article>)}</div>{records.length === 0 ? <p>No published records are available in this category.</p> : <div className="record-grid">{records.map((record) => <RecordCard key={record.slug} record={record} />)}</div>}</main>;
}
