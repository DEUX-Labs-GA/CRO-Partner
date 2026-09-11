import { register } from "@shopify/web-pixels-extension";
import {
  CRO_PARTNER_EVENT_NAMES,
  normalizeShopifyEvent,
} from "./event-schema";

register(({ analytics, settings }) => {
  const sourceId =
    typeof settings.sourceID === "string" && settings.sourceID.trim()
      ? settings.sourceID.trim()
      : "cro-partner";

  const endpointURL =
    typeof settings.endpointURL === "string"
      ? settings.endpointURL.trim()
      : "";

  const shopDomain =
    typeof settings.shopDomain === "string"
      ? settings.shopDomain.trim()
      : "";

  CRO_PARTNER_EVENT_NAMES.forEach((eventName) => {
    analytics.subscribe(eventName, (event) => {
      const payload = {
        ...normalizeShopifyEvent(event, { sourceId }),
        shop: shopDomain || null,
      };

      if (!endpointURL || !shopDomain) {
        console.warn(
          "[CRO Partner pixel] Transport skipped: endpointURL or shopDomain missing.",
        );
        return;
      }

      fetch(endpointURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify(payload),
      }).catch((error) => {
        // Behavioral analytics must never interfere with the storefront.
        console.warn("[CRO Partner pixel] Event delivery failed.", error);
      });
    });
  });
});
