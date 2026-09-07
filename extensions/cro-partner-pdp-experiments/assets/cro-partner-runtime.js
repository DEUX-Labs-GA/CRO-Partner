(() => {
  "use strict";

  // This entry point only establishes guarded page context. Visitor assignment,
  // analytics, and variant rendering will plug in after the experiment contract
  // and storefront event model are defined.
  const shopifyNamespace = window.Shopify || (window.Shopify = {});

  if (shopifyNamespace.croPartner?.initialized) {
    return;
  }

  const productContext = readProductContext();
  const runtimeContext = {
    initialized: true,
    isProductPage: productContext !== null,
    product: productContext,
  };

  shopifyNamespace.croPartner = runtimeContext;

  function readProductContext() {
    const pageType = getPageType();

    if (pageType !== "product") {
      return null;
    }

    const analyticsProduct = window.ShopifyAnalytics?.meta?.product;
    const structuredProduct = readStructuredProduct();

    return {
      id: analyticsProduct?.id ?? structuredProduct?.id ?? null,
      handle: analyticsProduct?.handle ?? structuredProduct?.handle ?? null,
      url: window.location.href,
    };
  }

  function getPageType() {
    const pageTypeMeta = document.querySelector('meta[property="og:type"]');
    const pageType = pageTypeMeta?.getAttribute("content")?.toLowerCase();

    if (pageType === "product") {
      return "product";
    }

    const productPath = window.location.pathname.match(/^\/products\/[^/]+/);
    return productPath ? "product" : null;
  }

  function readStructuredProduct() {
    const structuredData = document.querySelector(
      'script[type="application/ld+json"]',
    );

    if (!structuredData?.textContent) {
      return null;
    }

    try {
      const parsedData = JSON.parse(structuredData.textContent);
      const product = Array.isArray(parsedData)
        ? parsedData.find((entry) => entry?.["@type"] === "Product")
        : parsedData?.["@type"] === "Product"
          ? parsedData
          : null;

      return product
        ? {
            id: product.sku ?? null,
            handle: product.url ? product.url.split("/").pop() : null,
          }
        : null;
    } catch {
      return null;
    }
  }
})();