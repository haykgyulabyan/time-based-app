import express from "express";
import database from "../database.js";

const router = express.Router();

// Helper to verify shop ownership
async function verifyShopOwnership(id, shop) {
  const bar = await database.getAnnouncementBarById(id);
  if (!bar) return { error: "Announcement bar not found", status: 404 };
  if (bar.shop !== shop) return { error: "Unauthorized", status: 403 };
  return { bar };
}

// GET /api/announcement-bars - List all announcement bars for shop
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const bars = await database.getAllAnnouncementBars(session.shop);
    res.json({ announcementBars: bars });
  } catch (error) {
    console.error("[API] Error fetching announcement bars:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/announcement-bars/:id - Get single announcement bar
router.get("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    res.json({ announcementBar: verification.bar });
  } catch (error) {
    console.error("[API] Error fetching announcement bar:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/announcement-bars - Create new announcement bar
router.post("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const data = req.body;

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const bar = await database.createAnnouncementBar(session.shop, data);
    res.status(201).json({ announcementBar: bar });
  } catch (error) {
    console.error("[API] Error creating announcement bar:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/announcement-bars/priorities - Update priorities (must come before /:id)
router.put("/priorities", async (req, res) => {
  try {
    const { priorities } = req.body;

    if (!Array.isArray(priorities)) {
      return res.status(400).json({ error: "priorities must be an array" });
    }

    await database.updateAllPriorities(priorities);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating priorities:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/announcement-bars/:id - Update announcement bar
router.put("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;
    const data = req.body;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const bar = await database.updateAnnouncementBar(id, data);
    res.json({ announcementBar: bar });
  } catch (error) {
    console.error("[API] Error updating announcement bar:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/announcement-bars/:id - Delete announcement bar
router.delete("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    await database.deleteAnnouncementBar(id);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting announcement bar:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/announcement-bars/:id/duplicate - Duplicate announcement bar
router.post("/:id/duplicate", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { id } = req.params;

    const verification = await verifyShopOwnership(id, session.shop);
    if (verification.error) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const bar = await database.duplicateAnnouncementBar(id, session.shop);
    res.status(201).json({ announcementBar: bar });
  } catch (error) {
    console.error("[API] Error duplicating announcement bar:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
