import express from "express";
import database from "../database.js";

const router = express.Router();

// Helper to verify shop ownership
async function verifyShopOwnership(id, shop) {
  const advertisement = await database.getAdvertisementById(id);
  if (!advertisement) return { error: "Advertisement not found", status: 404 };
  if (advertisement.shop !== shop) return { error: "Unauthorized", status: 403 };
  return { advertisement };
}

// Helper to sync enabled advertisements to shop metafield
async function syncAdvertisementsMetafield(shop, session, shopify) {
  try {
    // Get all enabled advertisements for this shop
    const advertisements = await database.getActiveAdvertisements(shop);
    const adList = advertisements.map(ad => ({
      id: ad.id,
      name: ad.name,
      size: ad.size
    }));

    // Get shop ID from session
    const client = new shopify.api.clients.Graphql({ session });

    // First, get the shop's GID
    const shopResponse = await client.query({
      data: `{
        shop {
          id
        }
      }`
    });

    const shopGid = shopResponse.body.data.shop.id;

    // Update the metafield
    await client.query({
      data: {
        query: `
          mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                namespace
                key
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          metafields: [{
            namespace: "time_based_app",
            key: "advertisements",
            value: JSON.stringify(adList),
            type: "json",
            ownerId: shopGid
          }]
        }
      }
    });

    console.log(`[API] Synced ${adList.length} advertisements to metafield for shop: ${shop}`);
  } catch (error) {
    console.error("[API] Error syncing advertisements metafield:", error);
    // Don't throw - metafield sync failure shouldn't block the main operation
  }
}

// GET /api/advertisements - List all advertisements for shop
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const advertisements = await database.getAllAdvertisements(session.shop);
    res.json({ advertisements });
  } catch (error) {
    console.error("[API] Error fetching advertisements:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/advertisements/:id - Get single advertisement
router.get("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    res.json({ advertisement: verification.advertisement });
  } catch (error) {
    console.error("[API] Error fetching advertisement:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/advertisements - Create new advertisement
router.post("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shopify = res.locals.shopify;
    const data = req.body;

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const advertisement = await database.createAdvertisement(session.shop, data);

    // Sync to metafield if the new ad is enabled
    if (advertisement.status) {
      await syncAdvertisementsMetafield(session.shop, session, shopify);
    }

    res.status(201).json({ advertisement });
  } catch (error) {
    console.error("[API] Error creating advertisement:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/advertisements/:id - Update advertisement
router.put("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shopify = res.locals.shopify;
    const { id } = req.params;
    const data = req.body;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const advertisement = await database.updateAdvertisement(id, data);

    // Sync to metafield (status might have changed)
    await syncAdvertisementsMetafield(session.shop, session, shopify);

    res.json({ advertisement });
  } catch (error) {
    console.error("[API] Error updating advertisement:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/advertisements/:id - Delete advertisement
router.delete("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shopify = res.locals.shopify;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    await database.deleteAdvertisement(id);

    // Sync to metafield (ad was removed)
    await syncAdvertisementsMetafield(session.shop, session, shopify);

    res.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting advertisement:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/advertisements/:id/duplicate - Duplicate advertisement
router.post("/:id/duplicate", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shopify = res.locals.shopify;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const advertisement = await database.duplicateAdvertisement(id, session.shop);

    // Sync to metafield if the duplicated ad is enabled
    if (advertisement.status) {
      await syncAdvertisementsMetafield(session.shop, session, shopify);
    }

    res.status(201).json({ advertisement });
  } catch (error) {
    console.error("[API] Error duplicating advertisement:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
