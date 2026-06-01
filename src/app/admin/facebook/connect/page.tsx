import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysLeft(value?: Date | null) {
  return value ? Math.ceil((value.getTime() - Date.now()) / 86_400_000) : undefined;
}

export default async function FacebookConnectPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const params = await searchParams;
  const connection = await getDb().facebookConnection.findUnique({ where: { id: "primary" } });
  return <main><section className="content-card"><p className="eyebrow">ADMIN FACEBOOK CONNECTION</p><h1>Facebook Page reconnect</h1><p>This protected workflow uses normal Facebook Login, exchanges the returned user grant, locates the configured Page through <code>/me/accounts</code>, and stores the Page token encrypted on the server.</p>{params.connected==="1"&&<p className="notice">Facebook Page connection saved. Posting remains disabled until explicitly enabled later.</p>}{params.error&&<p className="notice">Reconnect did not complete: {params.error}</p>}<section className="booking-summary"><h2>Connection status</h2><p><strong>Connected:</strong> {connection?"yes":"no"}</p><p><strong>Page name:</strong> {connection?.pageName??"not connected"}</p><p><strong>Page ID:</strong> {connection?.pageId??"not connected"}</p><p><strong>Token status:</strong> {connection?.tokenStatus??"not checked"}</p><p><strong>Estimated expiration:</strong> {connection?.tokenExpiresAt?.toISOString()??"not reported"}</p><p><strong>Days left:</strong> {daysLeft(connection?.tokenExpiresAt)??"unknown"}</p><p><strong>Last health check:</strong> {connection?.lastHealthCheckAt?.toISOString()??"not checked"}</p><p><strong>Last successful post:</strong> {connection?.lastSuccessfulPostAt?.toISOString()??"none"}</p><p><strong>Last Facebook error:</strong> {connection?.lastFacebookError??"none"}</p></section><div className="button-row"><Link className="button" href="/admin/facebook/connect/start">Reconnect Facebook</Link><Link className="secondary-button" href="/admin">Back to dashboard</Link></div><p className="notice">Live posting remains off. Use the health-check command after reconnecting. The separate test-post command remains disabled unless explicitly unlocked for a one-shot test.</p></section></main>;
}
