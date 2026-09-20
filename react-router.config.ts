import type { Config } from "@react-router/dev/config";

export default {
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "cro-partner-production.up.railway.app",
    "*.trycloudflare.com",
  ],
} satisfies Config;
