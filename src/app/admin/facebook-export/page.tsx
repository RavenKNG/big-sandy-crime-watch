import { CopyDraftButton } from "@/components/CopyDraftButton";
import { articles } from "@/lib/demo-data";
import { createArticleDraft } from "@/lib/facebook";

export default function FacebookExportPage() {
  const article = articles[0];
  const draft = createArticleDraft(article);
  return <main><section className="content-card"><p className="eyebrow">MANUAL FACEBOOK EXPORT</p><h1>{article.title}</h1><p>Copy this reviewed editorial draft for manual posting. Official API posting remains disabled.</p><textarea readOnly value={draft} /><p><strong>Target URL:</strong> https://BigSandyCrimeWatch.com/news/{article.slug}</p><p><strong>Image path:</strong> No image selected</p><CopyDraftButton text={draft} /><p className="muted">Manual posted-status persistence becomes active after database setup.</p></section></main>;
}
