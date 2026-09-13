(() => {
  "use strict";

  const shopifyNamespace = window.Shopify || (window.Shopify = {});

  if (shopifyNamespace.croPartner?.initialized) {
    return;
  }

  const VISITOR_COOKIE = "cro_partner_vid";
  const ASSIGNMENT_STORAGE_PREFIX = "cro_partner_assignment:";

  const EXPERIMENT_CONFIG = {
    id: "test-experiment-1",
    productId: "15273137996140",
    variants: ["control", "variant-a"],
    variantContent: {
      "variant-a": {
        title: "The Collection Snowboard: Liquid — Built to Flow",
      },
    },
  };

  const productContext = readProductContext();
  const visitorId = getOrCreateVisitorId();

  const runtimeContext = {
    initialized: true,
    isProductPage: productContext !== null,
    product: productContext,
    visitorId,
    getAssignment,
    assignExperiment,
    activeExperiment: null,
  };

  shopifyNamespace.croPartner = runtimeContext;

  loadActiveExperiment();

  async function loadActiveExperiment() {
    try {
      const response = await fetch(
        `/apps/cro-partner?ts=${Date.now()}`,
        {
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const activeExperiment = payload?.activeExperiment;

      if (
        !activeExperiment ||
        activeExperiment.status !== "RUNNING" ||
        activeExperiment.trackingKey !== EXPERIMENT_CONFIG.id
      ) {
        return;
      }

      runActiveExperiment();
    } catch {
      /*
       * Fail closed. If CRO Partner cannot confirm that the
       * experiment is running, do not render an experiment.
       */
    }
  }

  function runActiveExperiment() {
    if (!productContext) {
      return;
    }

    if (
      String(productContext.id) !==
      String(EXPERIMENT_CONFIG.productId)
    ) {
      return;
    }

    const assignment = assignExperiment(
      EXPERIMENT_CONFIG.id,
      EXPERIMENT_CONFIG.variants,
    );

    if (!assignment) {
      return;
    }

    runtimeContext.activeExperiment = {
      experimentId: EXPERIMENT_CONFIG.id,
      assignment,
      rendered: false,
    };

    if (assignment.variantId === "control") {
      runtimeContext.activeExperiment.rendered = true;
      publishExposure(assignment);
      return;
    }

    const variant =
      EXPERIMENT_CONFIG.variantContent[assignment.variantId];

    if (!variant) {
      return;
    }

    renderVariantWhenReady(assignment, variant);
  }

  function renderVariantWhenReady(assignment, variant) {
    if (renderVariant(assignment, variant)) {
      return;
    }

    const root =
      document.querySelector("#MainContent") ||
      document.querySelector("main") ||
      document.body;

    if (!root) {
      return;
    }

    let observer = null;

    const timeoutId = window.setTimeout(() => {
      observer?.disconnect();
    }, 5000);

    observer = new MutationObserver(() => {
      if (!renderVariant(assignment, variant)) {
        return;
      }

      observer.disconnect();
      window.clearTimeout(timeoutId);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  function renderVariant(assignment, variant) {
    const titleElement = findProductTitle();

    if (!titleElement) {
      return false;
    }

    const renderKey =
      `${assignment.experimentId}:${assignment.variantId}`;

    if (titleElement.dataset.croPartnerRender === renderKey) {
      runtimeContext.activeExperiment.rendered = true;
      return true;
    }

    if (!titleElement.dataset.croPartnerOriginalText) {
      titleElement.dataset.croPartnerOriginalText =
        titleElement.textContent?.trim() ?? "";
    }

    if (typeof variant.title === "string") {
      titleElement.textContent = variant.title;
    }

    titleElement.dataset.croPartnerRender = renderKey;
    runtimeContext.activeExperiment.rendered = true;

    publishExposure(assignment);

    return true;
  }

  function publishExposure(
    assignment,
    attempt = 0,
  ) {
    const exposureKey =
      `cro_partner_exposure:${assignment.experimentId}`;

    try {
      if (
        window.sessionStorage.getItem(exposureKey) ===
        assignment.variantId
      ) {
        return;
      }
    } catch {
      // Continue even if session storage is unavailable.
    }

    if (
      !window.Shopify?.analytics ||
      typeof window.Shopify.analytics.publish !== "function"
    ) {
      if (attempt < 50) {
        window.setTimeout(() => {
          publishExposure(
            assignment,
            attempt + 1,
          );
        }, 100);
      }

      return;
    }

    window.Shopify.analytics.publish(
      "cro_partner:experiment_exposure",
      {
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
      },
    );

    try {
      window.sessionStorage.setItem(
        exposureKey,
        assignment.variantId,
      );
    } catch {
      // Exposure was still published.
    }
  }

  function findProductTitle() {
    const selectors = [
      "h1.product__title",
      ".product__title h1",
      "h1.product-title",
      "[data-product-title]",
      "main h1",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function getOrCreateVisitorId() {
    const existingVisitorId = readCookie(VISITOR_COOKIE);

    if (existingVisitorId) {
      return existingVisitorId;
    }

    const visitorId = createId();

    writeCookie(
      VISITOR_COOKIE,
      visitorId,
      365,
    );

    return visitorId;
  }

  function getAssignment(experimentId) {
    if (!experimentId) {
      return null;
    }

    const storageKey =
      `${ASSIGNMENT_STORAGE_PREFIX}${experimentId}`;

    try {
      const rawValue = window.localStorage.getItem(storageKey);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue);

      if (
        !parsedValue ||
        parsedValue.experimentId !== experimentId ||
        typeof parsedValue.variantId !== "string"
      ) {
        return null;
      }

      return parsedValue;
    } catch {
      return null;
    }
  }

  function assignExperiment(experimentId, variantIds) {
    if (
      !experimentId ||
      !Array.isArray(variantIds) ||
      variantIds.length < 1
    ) {
      return null;
    }

    const existingAssignment = getAssignment(experimentId);

    if (
      existingAssignment &&
      variantIds.includes(existingAssignment.variantId)
    ) {
      return existingAssignment;
    }

    const variantId =
      variantIds[randomIndex(variantIds.length)];

    const assignment = {
      experimentId,
      variantId,
      visitorId,
      assignedAt: new Date().toISOString(),
    };

    const storageKey =
      `${ASSIGNMENT_STORAGE_PREFIX}${experimentId}`;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(assignment),
      );
    } catch {
      /*
       * Assignment still works for this page even if storage
       * is unavailable. Persistence will simply be lost.
       */
    }

    return assignment;
  }

  function randomIndex(length) {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === "function"
    ) {
      const randomValues = new Uint32Array(1);

      window.crypto.getRandomValues(randomValues);

      return randomValues[0] % length;
    }

    return Math.floor(Math.random() * length);
  }

  function createId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2),
    ].join("-");
  }

  function readCookie(name) {
    const prefix = `${name}=`;

    const cookie = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix));

    return cookie
      ? decodeURIComponent(cookie.slice(prefix.length))
      : null;
  }

  function writeCookie(name, value, days) {
    const maxAge = Math.max(days, 1) * 24 * 60 * 60;

    document.cookie = [
      `${name}=${encodeURIComponent(value)}`,
      "Path=/",
      `Max-Age=${maxAge}`,
      "SameSite=Lax",
    ].join("; ");
  }

  function readProductContext() {
    const pageType = getPageType();

    if (pageType !== "product") {
      return null;
    }

    const analyticsProduct = window.ShopifyAnalytics?.meta?.product;
    const structuredProduct = readStructuredProduct();

    return {
      id: analyticsProduct?.id ?? structuredProduct?.id ?? null,
      handle:
        analyticsProduct?.handle ??
        structuredProduct?.handle ??
        null,
      url: window.location.href,
    };
  }

  function getPageType() {
    const pageTypeMeta = document.querySelector(
      'meta[property="og:type"]',
    );

    const pageType =
      pageTypeMeta?.getAttribute("content")?.toLowerCase();

    if (pageType === "product") {
      return "product";
    }

    const productPath =
      window.location.pathname.match(/^\/products\/[^/]+/);

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
        ? parsedData.find(
            (entry) => entry?.["@type"] === "Product",
          )
        : parsedData?.["@type"] === "Product"
          ? parsedData
          : null;

      return product
        ? {
            id: product.sku ?? null,
            handle: product.url
              ? product.url.split("/").pop()
              : null,
          }
        : null;
    } catch {
      return null;
    }
  }
})();
