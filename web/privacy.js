import { DeliveryMethod } from "@shopify/shopify-api";
import database from "./database.js";

/**
 * Privacy webhook handlers required by Shopify
 * These handle GDPR-related requests for customer data
 */
const PrivacyWebhookHandlers = {
  /**
   * Customers can request their data from a store owner.
   * If the app stores customer data, it should return the data to the store owner.
   */
  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      console.log("[Privacy] CUSTOMERS_DATA_REQUEST webhook received");
      console.log("[Privacy] Shop:", shop);
      console.log("[Privacy] Webhook ID:", webhookId);

      try {
        const payload = JSON.parse(body);
        console.log("[Privacy] Customer ID:", payload.customer?.id);

        // This app does not store customer personal data
        // It only stores shop-level announcement bar configurations
        // Therefore, no customer data needs to be returned

        console.log("[Privacy] No customer data stored by this app - request acknowledged");
      } catch (error) {
        console.error("[Privacy] Error processing CUSTOMERS_DATA_REQUEST:", error);
      }
    },
  },

  /**
   * Store owners can request that data is deleted on behalf of a customer.
   */
  CUSTOMERS_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      console.log("[Privacy] CUSTOMERS_REDACT webhook received");
      console.log("[Privacy] Shop:", shop);
      console.log("[Privacy] Webhook ID:", webhookId);

      try {
        const payload = JSON.parse(body);
        console.log("[Privacy] Customer ID:", payload.customer?.id);

        // This app does not store customer personal data
        // Therefore, no customer data needs to be deleted

        console.log("[Privacy] No customer data stored by this app - redact acknowledged");
      } catch (error) {
        console.error("[Privacy] Error processing CUSTOMERS_REDACT:", error);
      }
    },
  },

  /**
   * 48 hours after a store owner uninstalls the app, Shopify sends this webhook.
   * The app should delete all data associated with the store.
   */
  SHOP_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      console.log("[Privacy] SHOP_REDACT webhook received");
      console.log("[Privacy] Shop:", shop);
      console.log("[Privacy] Webhook ID:", webhookId);

      try {
        // Delete all announcement bars for this shop
        const deletedCount = await database.deleteShopData(shop);
        console.log(`[Privacy] Deleted ${deletedCount} records for shop: ${shop}`);
      } catch (error) {
        console.error("[Privacy] Error processing SHOP_REDACT:", error);
      }
    },
  },
};

export default PrivacyWebhookHandlers;
