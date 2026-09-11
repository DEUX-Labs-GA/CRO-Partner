import type { ActionFunctionArgs } from "react-router";
import { persistBehaviorEvent } from "../services/behavior-event.server";

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

  try {
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

    const body = await request.json();
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
