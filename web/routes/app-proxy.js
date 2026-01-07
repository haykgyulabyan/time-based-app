import express from "express";
import database from "../database.js";
import { appProxyAuthMiddleware } from "../app-proxy-auth.js";

const router = express.Router();

/**
 * App Proxy route for storefront
 * GET /banners?shop=...&path=...&product_type=...&collection=...
 *
 * Returns all active announcement bars that match the current page
 * Schedule checking is done client-side to allow for caching
 */
router.get(
  "/banners",
  appProxyAuthMiddleware(process.env.SHOPIFY_API_SECRET),
  async (req, res) => {
    try {
      const { shop, path, product_type, collection, logged_in_customer_id } = req.query;

      if (!shop) {
        return res.status(400).json({ error: "Missing shop parameter" });
      }

      console.log("[App Proxy] Fetching banners for shop:", shop);
      console.log("[App Proxy] Path:", path);

      // Get all active announcement bars for the shop
      const bars = await database.getActiveAnnouncementBars(shop);

      if (!bars || bars.length === 0) {
        return res.json({ banners: [] });
      }

      // Filter banners based on page assignment
      const matchingBanners = bars.filter((bar) => {
        const assignment = bar.assignment || {};

        // Check if banner is assigned to this page type
        const isHomepage = path === "/" || path === "";
        const isProductPage = path?.includes("/products/");
        const isCollectionPage = path?.includes("/collections/");

        // Homepage assignment
        if (isHomepage && assignment.homepage) {
          return true;
        }

        // Product page assignment by product type
        if (isProductPage && assignment.productTypes?.length > 0 && product_type) {
          if (assignment.productTypes.includes(product_type)) {
            return true;
          }
        }

        // Collection page assignment
        if (isCollectionPage && assignment.collections?.length > 0 && collection) {
          if (assignment.collections.includes(collection)) {
            return true;
          }
        }

        // If no specific assignment, check if it's a global banner
        // A banner with no specific assignments shows everywhere
        const hasNoAssignments =
          !assignment.homepage &&
          (!assignment.productTypes || assignment.productTypes.length === 0) &&
          (!assignment.collections || assignment.collections.length === 0) &&
          (!assignment.categories || assignment.categories.length === 0);

        return hasNoAssignments;
      });

      // Helper to construct link URL based on link type
      const constructLinkUrl = (bar) => {
        if (!bar.linkEnabled || !bar.linkType) return null;

        switch (bar.linkType) {
          case "external":
            return bar.linkValue;
          case "productType":
            return `/collections/all/${bar.linkValue}`;
          case "collection":
            return `/collections/${bar.linkValue}`;
          case "homepage":
            return "/";
          default:
            return bar.linkValue;
        }
      };

      // Format response for client-side rendering
      const response = {
        banners: matchingBanners.map((bar) => ({
          id: bar.id,
          status: bar.status,
          backgroundColor: bar.backgroundColor,
          content: bar.content,
          linkEnabled: bar.linkEnabled,
          linkUrl: constructLinkUrl(bar),
          linkTarget: bar.linkTarget || "_self",
          couponEnabled: bar.couponEnabled,
          couponCode: bar.couponCode,
          couponDisplay: bar.couponDisplay,
          schedulingEnabled: bar.schedulingEnabled,
          startDate: bar.startDate,
          endDate: bar.endDate,
          priority: bar.priority,
        })),
      };

      // Set cache headers (cache for 5 minutes, client handles schedule checking)
      res.set("Cache-Control", "public, max-age=300");
      res.json(response);
    } catch (error) {
      console.error("[App Proxy] Error fetching banners:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * App Proxy route for slider banners on storefront
 * GET /slider-banners?shop=...&path=...&product_type=...&collection=...
 *
 * Returns all active slider banners that match the current page
 * Schedule checking is done client-side to allow for caching
 */
router.get(
  "/slider-banners",
  appProxyAuthMiddleware(process.env.SHOPIFY_API_SECRET),
  async (req, res) => {
    try {
      const { shop, path, product_type, collection, logged_in_customer_id } = req.query;

      if (!shop) {
        return res.status(400).json({ error: "Missing shop parameter" });
      }

      console.log("[App Proxy] Fetching slider banners for shop:", shop);
      console.log("[App Proxy] Path:", path);

      // Get all active slider banners for the shop
      const sliders = await database.getActiveSliderBanners(shop);

      if (!sliders || sliders.length === 0) {
        return res.json({ sliders: [] });
      }

      // Filter sliders based on page assignment
      const matchingSliders = sliders.filter((slider) => {
        const assignment = slider.assignment || {};

        // Check if slider is assigned to this page type
        const isHomepage = path === "/" || path === "";
        const isProductPage = path?.includes("/products/");
        const isCollectionPage = path?.includes("/collections/");

        // Homepage assignment
        if (isHomepage && assignment.homepage) {
          return true;
        }

        // Product page assignment by product type
        if (isProductPage && assignment.productTypes?.length > 0 && product_type) {
          if (assignment.productTypes.includes(product_type)) {
            return true;
          }
        }

        // Collection page assignment
        if (isCollectionPage && assignment.collections?.length > 0 && collection) {
          if (assignment.collections.includes(collection)) {
            return true;
          }
        }

        // If no specific assignment, check if it's a global slider
        // A slider with no specific assignments shows everywhere
        const hasNoAssignments =
          !assignment.homepage &&
          (!assignment.productTypes || assignment.productTypes.length === 0) &&
          (!assignment.collections || assignment.collections.length === 0) &&
          (!assignment.categories || assignment.categories.length === 0);

        return hasNoAssignments;
      });

      // Format response for client-side rendering
      const response = {
        sliders: matchingSliders.map((slider) => ({
          id: slider.id,
          name: slider.name,
          status: slider.status,
          desktopAspectRatio: slider.desktopAspectRatio,
          mobileAspectRatio: slider.mobileAspectRatio,
          addBorder: slider.addBorder,
          transitionEffect: slider.transitionEffect,
          delayBetweenSlides: slider.delayBetweenSlides,
          slides: slider.slides,
          schedulingEnabled: slider.schedulingEnabled,
          startDate: slider.startDate,
          endDate: slider.endDate,
          priority: slider.priority,
        })),
      };

      // Set cache headers (cache for 5 minutes, client handles schedule checking)
      res.set("Cache-Control", "public, max-age=300");
      res.json(response);
    } catch (error) {
      console.error("[App Proxy] Error fetching slider banners:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
