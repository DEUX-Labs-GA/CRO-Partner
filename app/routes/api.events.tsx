import type { ActionFunctionArgs } from "react-router";
import { persistBehaviorEvent } from "../services/behavior-event.server";

export const MAX_EVENT_REQUEST_BYTES = 64 * 1024;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return Response.json(
      { ok: false, error: "Expected application/json." },
      {
        status: 415,
        headers: corsHeaders(),
      },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_EVENT_REQUEST_BYTES
  ) {
    return Response.json(
      { ok: false, error: "Request too large." },
      {
        status: 413,
        headers: corsHeaders(),
      },
    );
  }

  try {
    const rawBody = await request.text();
    const bodySize = new TextEncoder().encode(rawBody).byteLength;

    if (bodySize > MAX_EVENT_REQUEST_BYTES) {
      return Response.json(
        { ok: false, error: "Request too large." },
        {
          status: 413,
          headers: corsHeaders(),
        },
      );
    }

    const body = JSON.parse(rawBody);
    const result = await persistBehaviorEvent(body);

    return Response.json(
      {
        ok: true,
        status: result.status,
      },
      {
        status: result.status === "duplicate" ? 200 : 201,
        headers: corsHeaders(),
      },
    );
  } catch (error) {
    console.error("Behavior event ingestion failed", error);

    return Response.json(
      {
        ok: false,
        error: "Invalid event.",
      },
      {
        status: 400,
        headers: corsHeaders(),
      },
    );
  }
}

export async function loader() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
