// @ts-check
import "dotenv/config";
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import database from "./database.js";
import PrivacyWebhookHandlers from "./privacy.js";
import announcementBarsRoutes from "./routes/announcement-bars.js";
import sliderBannersRoutes from "./routes/slider-banners.js";
import advertisementsRoutes from "./routes/advertisements.js";
import filesRoutes from "./routes/files.js";
import appProxyRoutes from "./routes/app-proxy.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/web/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Initialize database before handling requests
let dbInitialized = false;
let dbInitPromise = null;

async function initializeDatabase() {
  if (!dbInitialized && !dbInitPromise) {
    dbInitPromise = database.initialize().then(() => {
      dbInitialized = true;
      console.log("[Server] Database initialized successfully");
    }).catch((error) => {
      console.error("[Server] Failed to initialize database:", error);
      dbInitPromise = null;
      throw error;
    });
  }
  return dbInitPromise;
}

// Middleware to ensure database is initialized
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("[Server] Database initialization failed:", error);
    res.status(500).json({
      error: "Database initialization failed",
      message: error.message,
    });
  }
});

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

// Exit iframe handler - serves a page that uses App Bridge to redirect
app.get("/exitiframe", (req, res) => {
  const { redirectUri, shop, host } = req.query;
  const apiKey = process.env.SHOPIFY_API_KEY;

  res.set("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <script src="https://unpkg.com/@shopify/app-bridge@3/umd/index.js"></script>
        <script>
          (function() {
            var redirectUri = "${redirectUri || ''}";
            var host = "${host || ''}";
            var apiKey = "${apiKey}";

            if (!redirectUri) return;
            var decodedUrl = decodeURIComponent(redirectUri);

            // Initialize App Bridge v3 for redirect
            var AppBridge = window['app-bridge'];
            if (AppBridge && host) {
              var app = AppBridge.createApp({
                apiKey: apiKey,
                host: host
              });
              var Redirect = AppBridge.actions.Redirect;
              var redirect = Redirect.create(app);
              redirect.dispatch(Redirect.Action.REMOTE, decodedUrl);
            } else {
              // Fallback
              window.location.href = decodedUrl;
            }
          })();
        </script>
      </head>
      <body>
        <p>Redirecting...</p>
      </body>
    </html>
  `);
});
app.post(
  shopify.config.webhooks.path,
  (req, res, next) => {
    console.log("[Server] ===== WEBHOOK RECEIVED =====");
    console.log("[Server] Topic:", req.headers["x-shopify-topic"]);
    console.log("[Server] Shop:", req.headers["x-shopify-shop-domain"]);
    next();
  },
  shopify.processWebhooks({
    webhookHandlers: { ...PrivacyWebhookHandlers }
  })
);

// App Proxy routes (no session required, HMAC validated)
// These are accessed from the storefront via /apps/time-based/...
app.use("/", appProxyRoutes);

// Parse JSON for API routes (increased limit for image uploads)
app.use(express.json({ limit: '50mb' }));

// All routes after this point require authentication
app.use("/api/*", shopify.validateAuthenticatedSession());

// API routes
app.use("/api/announcement-bars", announcementBarsRoutes);
app.use("/api/slider-banners", sliderBannersRoutes);
app.use("/api/advertisements", advertisementsRoutes);
app.use("/api/files", filesRoutes);

// GET /api/discounts - Fetch discount codes from Shopify
app.get("/api/discounts", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const response = await client.query({
      data: {
        query: `
          query GetDiscountCodes($first: Int!) {
            codeDiscountNodes(first: $first) {
              edges {
                node {
                  id
                  codeDiscount {
                    ... on DiscountCodeBasic {
                      title
                      codes(first: 1) {
                        edges {
                          node {
                            code
                          }
                        }
                      }
                      customerGets {
                        value {
                          ... on DiscountPercentage {
                            percentage
                          }
                          ... on DiscountAmount {
                            amount {
                              amount
                              currencyCode
                            }
                          }
                        }
                      }
                      status
                    }
                    ... on DiscountCodeFreeShipping {
                      title
                      codes(first: 1) {
                        edges {
                          node {
                            code
                          }
                        }
                      }
                      status
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { first: 50 },
      },
    });

    const discounts = response.body.data.codeDiscountNodes.edges.map((edge) => {
      const node = edge.node;
      const discount = node.codeDiscount;
      const code = discount.codes?.edges?.[0]?.node?.code || "";
      const value = discount.customerGets?.value;

      let discountValue = "";
      if (value?.percentage) {
        discountValue = `${Math.round(value.percentage * 100)}% off`;
      } else if (value?.amount) {
        discountValue = `${value.amount.currencyCode} ${value.amount.amount} off`;
      } else if (discount.__typename === "DiscountCodeFreeShipping") {
        discountValue = "Free shipping";
      }

      return {
        id: node.id,
        title: discount.title,
        code,
        value: discountValue,
        status: discount.status,
      };
    });

    res.json({ discounts });
  } catch (error) {
    console.error("[API] Error fetching discounts:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/collections - Fetch collections
app.get("/api/collections", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const response = await client.query({
      data: {
        query: `
          query GetCollections($first: Int!) {
            collections(first: $first) {
              edges {
                node {
                  id
                  title
                  handle
                }
              }
            }
          }
        `,
        variables: { first: 100 },
      },
    });

    const collections = response.body.data.collections.edges.map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
    }));

    res.json({ collections });
  } catch (error) {
    console.error("[API] Error fetching collections:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/product-types - Fetch product types
app.get("/api/product-types", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    // Fetch products and extract unique product types
    let productTypes = new Set();
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const response = await client.query({
        data: {
          query: `
            query GetProductTypes($first: Int!, $after: String) {
              products(first: $first, after: $after) {
                edges {
                  node {
                    productType
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          variables: { first: 250, after: cursor },
        },
      });

      const products = response.body.data.products;
      products.edges.forEach((edge) => {
        if (edge.node.productType) {
          productTypes.add(edge.node.productType);
        }
      });

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
    }

    res.json({ productTypes: Array.from(productTypes).sort() });
  } catch (error) {
    console.error("[API] Error fetching product types:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend static files
app.use(serveStatic(STATIC_PATH, { index: false }));

// Read built HTML file for production, or use fallback for development
let indexHtml;
if (process.env.NODE_ENV === "production") {
  try {
    indexHtml = readFileSync(join(STATIC_PATH, "index.html"), "utf-8");
  } catch (e) {
    console.error("[Server] Could not read built index.html:", e.message);
    indexHtml = null;
  }
}

// Catch-all route for SPA
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  const html = indexHtml || `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time-based App</title>
    <script type="module" src="/index.jsx"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`;

  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(html);
});

app.listen(PORT, () => {
  console.log(`[Server] Time-based App running on port ${PORT}`);
});
