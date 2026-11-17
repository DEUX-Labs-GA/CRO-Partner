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

import { action, ErrorBoundary } from "../routes/app.experiments.$id";

const experiment = {
  id: "experiment-1", shop: "example.myshopify.com", status: "RUNNING",
  updatedAt: new Date("2026-11-17T00:00:00Z"), variants: [],
};
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
  mocks.authenticate.mockResolvedValue({ admin: {}, session: { shop: experiment.shop } });
  mocks.findFirst.mockResolvedValue(experiment);
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.snapshot.mockResolvedValue({ completionSummary: "saved snapshot" });
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
    expect(mocks.snapshot).toHaveBeenCalledOnce();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "COMPLETED", completionSummary: "saved snapshot" },
    }));
  });
});
