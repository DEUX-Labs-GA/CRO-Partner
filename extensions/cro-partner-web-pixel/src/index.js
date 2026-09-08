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

  CRO_PARTNER_EVENT_NAMES.forEach((eventName) => {
    analytics.subscribe(eventName, (event) => {
      const payload = normalizeShopifyEvent(event, { sourceId });

      // Transport is intentionally deferred until the receiving endpoint and
      // request validation are implemented. Shopify's pixel debugger exposes
      // this payload so the event contract can be validated safely first.
      console.info("[CRO Partner pixel]", payload);
    });
  });
});
