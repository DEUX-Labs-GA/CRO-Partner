import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persistBehaviorEvent: vi.fn(),
}));

vi.mock("../services/behavior-event.server", () => ({
  persistBehaviorEvent: mocks.persistBehaviorEvent,
}));

import {
  action,
  MAX_EVENT_REQUEST_BYTES,
} from "../routes/api.events";

function actionArgs(request: Request) {
  return {
    request,
    params: {},
    context: {},
  } as any;
}

describe("behavior event ingestion route", () => {
  beforeEach(() => {
    mocks.persistBehaviorEvent.mockReset();
  });

  it("accepts a valid JSON event", async () => {
    mocks.persistBehaviorEvent.mockResolvedValue({
      status: "created",
      event: {},
    });

    const request = new Request("https://example.test/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop: "honey-babe-cro-test.myshopify.com",
      }),
    });

    const response = await action(actionArgs(request));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      status: "created",
    });
    expect(mocks.persistBehaviorEvent).toHaveBeenCalledOnce();
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("https://example.test/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "hello",
    });

    const response = await action(actionArgs(request));

    expect(response.status).toBe(415);
    expect(mocks.persistBehaviorEvent).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies", async () => {
    const oversizedBody = JSON.stringify({
      payload: "x".repeat(MAX_EVENT_REQUEST_BYTES + 1),
    });

    const request = new Request("https://example.test/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: oversizedBody,
    });

    const response = await action(actionArgs(request));

    expect(response.status).toBe(413);
    expect(mocks.persistBehaviorEvent).not.toHaveBeenCalled();
  });

  it("handles CORS preflight requests", async () => {
    const request = new Request("https://example.test/api/events", {
      method: "OPTIONS",
    });

    const response = await action(actionArgs(request));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(mocks.persistBehaviorEvent).not.toHaveBeenCalled();
  });
});
