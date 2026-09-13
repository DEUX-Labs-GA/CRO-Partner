import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } =
    await authenticate.public.appProxy(request);

  if (!session?.shop) {
    return Response.json(
      {
        activeExperiment: null,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  }

  const experiment = await prisma.experiment.findFirst({
    where: {
      shop: session.shop,
      status: "RUNNING",
      trackingKey: {
        not: null,
      },
    },
    include: {
      variants: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!experiment) {
    return Response.json(
      {
        activeExperiment: null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  }

  return Response.json(
    {
      activeExperiment: {
        experimentId: experiment.id,
        trackingKey: experiment.trackingKey,
        status: experiment.status,
        variants: experiment.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          isControl: variant.isControl,
        })),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
};
