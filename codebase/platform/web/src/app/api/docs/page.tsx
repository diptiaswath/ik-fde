import Script from "next/script";

// API reference, rendered by Redoc (standalone CDN bundle) against the spec at
// /api/v1/openapi.json. Renders inside the app's root layout (no nested <html>);
// the <redoc> custom element mounts itself once the standalone bundle loads.

export const metadata = {
  title: "Meridian Bank API — Reference",
};

export default function ApiDocsPage() {
  return (
    <>
      {/* @ts-expect-error — <redoc> is a custom element from the Redoc bundle */}
      <redoc spec-url="/api/v1/openapi.json"></redoc>
      <Script
        src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"
        strategy="afterInteractive"
      />
    </>
  );
}
