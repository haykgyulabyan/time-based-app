import { useEffect } from "react";

export default function ExitIframe() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get("redirectUri");

    if (redirectUri) {
      const decodedUrl = decodeURIComponent(redirectUri);

      // App Bridge v4 CDN exposes window.open that handles iframe escape
      // The CDN script automatically handles cross-origin navigation
      if (window.shopify) {
        window.open(decodedUrl, "_top");
      } else {
        window.location.href = decodedUrl;
      }
    }
  }, []);

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      Redirecting...
    </div>
  );
}
