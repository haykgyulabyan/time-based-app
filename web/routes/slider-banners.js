import express from "express";
import database from "../database.js";

const router = express.Router();

// Helper to verify shop ownership
async function verifyShopOwnership(id, shop) {
  const banner = await database.getSliderBannerById(id);
  if (!banner) return { error: "Slider banner not found", status: 404 };
  if (banner.shop !== shop) return { error: "Unauthorized", status: 403 };
  return { banner };
}

// GET /api/slider-banners - List all slider banners for shop
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const banners = await database.getAllSliderBanners(session.shop);
    res.json({ sliderBanners: banners });
  } catch (error) {
    console.error("[API] Error fetching slider banners:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/slider-banners/:id - Get single slider banner
router.get("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    res.json({ sliderBanner: verification.banner });
  } catch (error) {
    console.error("[API] Error fetching slider banner:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/slider-banners - Create new slider banner
router.post("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const data = req.body;

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const banner = await database.createSliderBanner(session.shop, data);
    res.status(201).json({ sliderBanner: banner });
  } catch (error) {
    console.error("[API] Error creating slider banner:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/slider-banners/:id - Update slider banner
router.put("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;
    const data = req.body;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const banner = await database.updateSliderBanner(id, data);
    res.json({ sliderBanner: banner });
  } catch (error) {
    console.error("[API] Error updating slider banner:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/slider-banners/:id - Delete slider banner
router.delete("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    await database.deleteSliderBanner(id);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting slider banner:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/slider-banners/:id/duplicate - Duplicate slider banner
router.post("/:id/duplicate", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const banner = await database.duplicateSliderBanner(id, session.shop);
    res.status(201).json({ sliderBanner: banner });
  } catch (error) {
    console.error("[API] Error duplicating slider banner:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
