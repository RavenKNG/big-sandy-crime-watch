import Link from "next/link";
import { formatDate } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewsIndexPage() {
  const articles = await getDb().article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <main>
      <p className="eyebrow">PUBLIC-SAFETY NEWS</p>
      <h1>News</h1>
      {articles.length === 0 ? (
        <p>No published news updates are available.</p>
      ) : (
        <div className="record-list">
          {articles.map((article) => (
            <article className="news-card" key={article.id}>
              <p className="eyebrow">
                {article.category} - {formatDate((article.publishedAt ?? article.createdAt).toISOString())}
              </p>
              <h2>{article.title}</h2>
              <p>{article.summary}</p>
              <Link href={`/news/${article.slug}`}>Read update</Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

