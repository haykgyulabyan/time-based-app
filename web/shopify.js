import { shopifyApp } from "@shopify/shopify-app-express";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import { createSessionStorage } from "./session-storage.js";
import { ApiVersion } from "@shopify/shopify-api";

// Validate required environment variables
const requiredEnvVars = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  HOST: process.env.HOST,
};

console.log("Environment variables check:");
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  console.log(`${key}: ${value ? "Set" : "Missing"}`);
});

const hostName = process.env.HOST?.replace(/https?:\/\//, "");

if (!hostName) {
  throw new Error(
    "Missing required environment variable: HOST. Please set it to your deployment URL."
  );
}

console.log("[Shopify] Initializing with hostName:", hostName);
console.log("[Shopify] API Key:", process.env.SHOPIFY_API_KEY?.substring(0, 8) + "...");

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES?.split(",") || ["read_themes", "write_content", "read_discounts", "read_products"],
    hostName,
    apiVersion: ApiVersion.January25,
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: await createSessionStorage(),
});

export default shopify;
