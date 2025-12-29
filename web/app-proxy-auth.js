import crypto from "crypto";

/**
 * Middleware to validate Shopify App Proxy requests using HMAC signature
 * App proxy requests include a signature query parameter that can be verified
 * to ensure the request is coming from Shopify
 */
export function appProxyAuthMiddleware(apiSecret) {
  return (req, res, next) => {
    // Skip validation in development if explicitly disabled
    if (process.env.SKIP_APP_PROXY_AUTH === "true") {
      console.log("[App Proxy Auth] Skipping validation (SKIP_APP_PROXY_AUTH=true)");
      return next();
    }

    if (!apiSecret) {
      console.error("[App Proxy Auth] API secret not provided");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Get the signature from query params
    const { signature, ...queryParams } = req.query;

    if (!signature) {
      console.error("[App Proxy Auth] No signature provided");
      return res.status(401).json({ error: "Unauthorized - missing signature" });
    }

    // Sort query parameters alphabetically and create the message string
    const sortedParams = Object.keys(queryParams)
      .sort()
      .map((key) => `${key}=${queryParams[key]}`)
      .join("");

    // Calculate HMAC
    const calculatedSignature = crypto
      .createHmac("sha256", apiSecret)
      .update(sortedParams)
      .digest("hex");

    // Compare signatures
    if (calculatedSignature !== signature) {
      console.error("[App Proxy Auth] Signature mismatch");
      console.error("[App Proxy Auth] Expected:", calculatedSignature);
      console.error("[App Proxy Auth] Received:", signature);
      return res.status(401).json({ error: "Unauthorized - invalid signature" });
    }

    console.log("[App Proxy Auth] Signature validated successfully");
    next();
  };
}
