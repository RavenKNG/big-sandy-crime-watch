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
    <main className="article-main">
      <article className="content-card news-article">
        <p className="eyebrow">
          {article.category} - {formatDate(publishedAt)}
        </p>
        <h1>{article.title}</h1>
        <p className="article-lead">{article.summary}</p>
        {"heroImageUrl" in article && article.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-image" src={article.heroImageUrl} alt="" />
        ) : null}
        <AdSlot placement="article-top" />
        <div className="article-body">
          {article.body.split("\n").map((paragraph, index) =>
            paragraph.trim() && !/^https?:\/\//i.test(paragraph.trim()) ? <p key={index}>{paragraph}</p> : null,
          )}
        </div>
        <div className="source-box">
          <p className="muted">Source: {article.sourceName ?? "Official release"}</p>
          {"sourceUrl" in article && article.sourceUrl ? (
            <a className="secondary-button" href={article.sourceUrl} rel="noopener noreferrer" target="_blank">
              {article.sourceName?.toLowerCase().includes("kentucky state police")
                ? "View Original KSP Release"
                : "View Original Release"}
            </a>
          ) : null}
        </div>
      </article>
    </main>
  );
}
