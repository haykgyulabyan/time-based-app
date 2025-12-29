import { useAppBridge } from "@shopify/app-bridge-react";
import { useMemo } from "react";

export function useAuthenticatedFetch() {
  const app = useAppBridge();

  const authenticatedFetch = useMemo(() => {
    return async (uri, options = {}) => {
      const response = await fetch(uri, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        credentials: "include",
      });

      if (
        response.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1"
      ) {
        const authUrlHeader =
          response.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url") ||
          `/api/auth`;

        window.top.location.href = authUrlHeader.startsWith("/")
          ? `https://${window.location.host}${authUrlHeader}`
          : authUrlHeader;
      }

      return response;
    };
  }, [app]);

  return authenticatedFetch;
}
