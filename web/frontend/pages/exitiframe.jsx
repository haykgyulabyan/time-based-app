import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ExitIframe() {
  const { search } = useLocation();

  useEffect(() => {
    if (search) {
      const params = new URLSearchParams(search);
      const redirectUri = params.get("redirectUri");

      if (redirectUri) {
        // Redirect the top-level window to break out of the iframe
        window.top.location.href = decodeURIComponent(redirectUri);
      }
    }
  }, [search]);

  return null;
}
