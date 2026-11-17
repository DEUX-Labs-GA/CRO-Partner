export const PRODUCT_FUNNEL_WINDOW_DAYS = 30;

export const PRODUCT_FUNNEL_WINDOW_OPTIONS = [7, 30, 90] as const;

export type ProductFunnelWindowDays =
  (typeof PRODUCT_FUNNEL_WINDOW_OPTIONS)[number];
