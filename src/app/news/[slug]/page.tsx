import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { formatDate, getArticle } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function findDbArticle(slug: string) {
  try {
    return await getDb().article.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
  } catch {
    return null;
  }
}

export default async function NewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const dbArticle = await findDbArticle(slug);
  const fallback = dbArticle ? null : getArticle(slug);
  const article = dbArticle ?? fallback;

  if (!article) notFound();

  const publishedAt =
    "publishedAt" in article && article.publishedAt
      ? article.publishedAt instanceof Date
        ? article.publishedAt.toISOString()
        : article.publishedAt
      : "createdAt" in article && article.createdAt instanceof Date
        ? article.createdAt.toISOString()
        : new Date().toISOString();

  return (
    <main>
      <article className="content-card">
        <p className="eyebrow">
          {article.category} - {formatDate(publishedAt)}
        </p>
        <h1>{article.title}</h1>
        <p>{article.summary}</p>
        {"heroImageUrl" in article && article.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-image" src={article.heroImageUrl} alt="" />
        ) : null}
        <AdSlot placement="article-top" />
        {article.body.split("\n").map((paragraph, index) =>
          paragraph.trim() ? <p key={index}>{paragraph}</p> : null,
        )}
        <p className="muted">
          Source: {article.sourceName}
          {"sourceUrl" in article && article.sourceUrl ? (
            <>
              {" "}
              <a href={article.sourceUrl}>Original release</a>
            </>
          ) : null}
        </p>
      </article>
    </main>
  );
}
