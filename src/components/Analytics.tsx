import Script from "next/script";

export function Analytics() {
  const siteId = process.env.ANALYTICS_SITE_ID;
  if (
    process.env.ANALYTICS_ENABLED !== "true" ||
    process.env.ANALYTICS_PROVIDER !== "ga4" ||
    !siteId
  ) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${siteId}`} strategy="afterInteractive" />
      <Script id="ga4-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${siteId}");`}
      </Script>
    </>
  );
}
