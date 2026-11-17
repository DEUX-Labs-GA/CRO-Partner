import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  authenticate: vi.fn(),
  snapshot: vi.fn(),
  boundaryError: vi.fn(),
}));
vi.mock("../db.server", () => ({
  default: { experiment: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));
vi.mock("../shopify.server", () => ({ authenticate: { admin: mocks.authenticate } }));
vi.mock("../services/experiment-knowledge.server", () => ({
  buildExperimentCompletionSnapshot: mocks.snapshot,
}));
vi.mock("@shopify/shopify-app-react-router/server", () => ({
  boundary: { error: mocks.boundaryError, headers: vi.fn() },
}));

import ExperimentDetailPage, { action, ErrorBoundary } from "../routes/app.experiments.$id";

const experiment = {
  id: "experiment-1", shop: "example.myshopify.com", status: "RUNNING",
  updatedAt: new Date("2026-11-17T00:00:00Z"), variants: [],
};
const admin = {};
const completionSnapshot = {
  completedAt: new Date("2026-11-17T01:00:00Z"),
  resultOutcome: "INSUFFICIENT_DATA",
  resultSummary: "Control: n/a (0/0). Treatment: n/a (0/0). Relative lift: n/a. p-value: n/a.",
  interpretation: "There was not enough analyzable evidence for a directional conclusion.",
  recommendationAction: "GATHER_MORE_DATA",
  recommendationTitle: "Keep collecting data",
  recommendationRationale: "There is not enough evidence to call a winner yet. Continue the experiment if the planned sample is realistically achievable.",
} satisfies Awaited<ReturnType<typeof import("../services/experiment-knowledge.server").buildExperimentCompletionSnapshot>>;

function request(status = "PAUSED", confirmed = false) {
  return new Request("https://example.test/app/experiments/experiment-1?shop=example.myshopify.com&host=test-host", {
    method: "POST",
    body: new URLSearchParams({ status, ...(confirmed ? { completionConfirmed: "true" } : {}) }),
  });
}
function runAction(status?: string, confirmed?: boolean) {
  return action({ request: request(status, confirmed), params: { id: experiment.id }, context: {} } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({ admin, session: { shop: experiment.shop } });
  mocks.findFirst.mockResolvedValue(experiment);
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.snapshot.mockResolvedValue(completionSnapshot);
  mocks.boundaryError.mockReturnValue(createElement("p", null, "Standard error"));
});

describe("experiment status conflict recovery", () => {
  it("keeps the scoped optimistic concurrency guard and returns HTTP 409", async () => {
    await expect(runAction()).rejects.toMatchObject({ status: 409 });
    expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: experiment.id, shop: experiment.shop, status: "RUNNING", updatedAt: experiment.updatedAt },
      data: { status: "PAUSED" },
    });
  });

  it("renders the conflict and reloads the current URL with a GET, without retrying the write", async () => {
    const loader = vi.fn().mockResolvedValue(null);
    const routes = [{
      path: "/app/experiments/:id", loader, action,
      Component: () => createElement("p", null, "Latest experiment"), ErrorBoundary,
    }];
    const handler = createStaticHandler(routes);
    const context = await handler.query(request());
    if (context instanceof Response) throw new Error("Unexpected response");
    expect(context.statusCode).toBe(409);
    const html = renderToStaticMarkup(createElement(StaticRouterProvider, {
      router: createStaticRouter(handler.dataRoutes, context), context,
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your status change was not saved");
    expect(html).toContain("Completing it will require confirmation");
    expect(html).toContain('href="/app/experiments/experiment-1?shop=example.myshopify.com&amp;host=test-host"');
    expect(html).toContain("Reload experiment");
    const recovered = await handler.query(new Request(request().url));
    if (recovered instanceof Response) throw new Error("Unexpected response");
    expect(recovered.statusCode).toBe(200);
    expect(recovered.errors).toBeNull();
    expect(loader).toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it("delegates non-conflict errors to Shopify's boundary", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const handler = createStaticHandler([{
      path: "/app/experiments/:id", action, ErrorBoundary,
      Component: () => null,
    }]);
    const context = await handler.query(request());
    if (context instanceof Response) throw new Error("Unexpected response");
    expect(context.statusCode).toBe(404);
    const html = renderToStaticMarkup(createElement(StaticRouterProvider, {
      router: createStaticRouter(handler.dataRoutes, context), context,
    }));
    expect(html).toContain("Standard error");
    expect(html).not.toContain("Reload experiment");
    expect(mocks.boundaryError).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("still requires explicit completion confirmation", async () => {
    await expect(runAction("COMPLETED")).rejects.toMatchObject({ status: 400 });
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("still rejects illegal lifecycle transitions", async () => {
    await expect(runAction("ARCHIVED", true)).rejects.toMatchObject({ status: 400 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("saves a confirmed completion snapshot when the guarded update succeeds", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    await expect(runAction("COMPLETED", true)).resolves.toEqual({ ok: true });
    expect(mocks.snapshot).toHaveBeenCalledExactlyOnceWith({ admin, shop: experiment.shop, experiment });
    expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: experiment.id, shop: experiment.shop, status: "RUNNING", updatedAt: experiment.updatedAt },
      data: { status: "COMPLETED", ...completionSnapshot },
    });
  });

  it("rejects a confirmed completion with HTTP 409 when the guarded update loses the race", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(runAction("COMPLETED", true)).rejects.toMatchObject({ status: 409 });
    expect(mocks.snapshot).toHaveBeenCalledExactlyOnceWith({ admin, shop: experiment.shop, experiment });
    expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: experiment.id, shop: experiment.shop, status: "RUNNING", updatedAt: experiment.updatedAt },
      data: { status: "COMPLETED", ...completionSnapshot },
    });
  });
});


describe("saved completion snapshot display", () => {
  const saved = {
    completedAt: new Date("2026-11-16T12:34:56Z"),
    resultOutcome: "TREATMENT_LEADING",
    resultSummary: "Saved summary from completion.",
    interpretation: "Saved directional interpretation.",
    recommendationAction: "DEPLOY",
    recommendationTitle: "Saved rollout recommendation",
    recommendationRationale: "Saved rationale from completion.",
  };

  type SavedSnapshot = { [Key in keyof typeof saved]: (typeof saved)[Key] | null };

  async function renderDetail(snapshot: SavedSnapshot = saved, status = "COMPLETED") {
    // Supply synthetic loader data; no service or Shopify calls are made.
    const handler = createStaticHandler([{
      path: "/app/experiments/:id",
      loader: () => ({
        experiment: {
          ...experiment, ...snapshot, status,
          name: "Synthetic experiment", hypothesis: "Synthetic hypothesis",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          metrics: [], significanceLevel: 0.95,
          baselineConversionRate: 0.05, minimumDetectableEffect: 0.2, statisticalPower: 0.8,
        },
        results: {
          totalExposedVisitors: 20, excludedAmbiguousVisitors: 0, currency: "USD",
          variants: ["control", "variant-a"].map(variantId => ({
            variantId, visitors: 10, purchases: 0, addedToCart: 0,
            checkoutStarted: 0, conversionRate: 0, revenue: 0, revenuePerVisitor: 0,
          })),
        },
        preAnalysis: {
          readiness: "READY_FOR_ESTIMATION", estimate: null,
          orderWindow: { label: "Last 30 days", days: 30 }, recentOrderCount: 0,
          orderDataAvailable: true, ordersPerDay: 0, productCount: 1,
        },
        exposureHistory: [], requiredSamplePerVariant: null,
      }),
      Component: ExperimentDetailPage,
    }]);
    const context = await handler.query(new Request(request().url));
    if (context instanceof Response) throw new Error("Unexpected response");
    expect(context.errors).toBeNull();
    return renderToStaticMarkup(createElement(StaticRouterProvider, {
      router: createStaticRouter(handler.dataRoutes, context), context, hydrate: false,
    }));
  }

  function savedSection(html: string) {
    return html.split('<s-section heading="Saved completion snapshot">')[1]?.split("</s-section>")[0];
  }

  it("shows persisted completion values separately from differing current analysis", async () => {
    const html = await renderDetail();
    const snapshot = savedSection(html);
    expect(snapshot).toContain("2026-11-16T12:34:56.000Z");
    expect(snapshot).toContain("Outcome: Treatment Leading");
    expect(snapshot).toContain(saved.resultSummary);
    expect(snapshot).toContain(saved.interpretation);
    expect(snapshot).toContain("Recommendation action: Deploy");
    expect(snapshot).toContain(saved.recommendationTitle);
    expect(snapshot).toContain(saved.recommendationRationale);
    expect(snapshot).not.toContain("Insufficient Data");
    const current = html.split('<s-section heading="Experiment results — current analysis">')[1];
    expect(current).toContain("Insufficient Data");
    expect(current).toContain("Keep collecting data");
    expect(current).toContain("recalculated using current data");
    expect(current).not.toContain(saved.resultSummary);
    expect(current).not.toContain(saved.recommendationRationale);
  });

  it("marks missing historical fields without substituting current analysis", async () => {
    const html = await renderDetail({
      completedAt: null, resultOutcome: null, resultSummary: null,
      interpretation: "", recommendationAction: null,
      recommendationTitle: " ", recommendationRationale: null,
    });
    const snapshot = savedSection(html)!;
    for (const label of ["Completion time", "Outcome", "Summary", "Interpretation",
      "Recommendation action", "Recommendation title", "Recommendation rationale"]) {
      expect(snapshot).toContain(`${label}: Not saved`);
    }
    expect(snapshot).not.toContain("Insufficient Data");
    expect(snapshot).not.toContain("Keep collecting data");
    expect(html).toContain("Keep collecting data");
  });

  it("keeps partially saved fields when other snapshot fields are missing", async () => {
    const snapshot = savedSection(await renderDetail({
      ...saved, interpretation: null, recommendationRationale: null,
    }));
    expect(snapshot).toContain(saved.resultSummary);
    expect(snapshot).toContain(saved.recommendationTitle);
    expect(snapshot).toContain("Interpretation: Not saved");
    expect(snapshot).toContain("Recommendation rationale: Not saved");
  });

  it("does not label active experiment data as a saved completion snapshot", async () => {
    expect(savedSection(await renderDetail(saved, "RUNNING"))).toBeUndefined();
  });
});
