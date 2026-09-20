import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

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
        headers: NO_CACHE_HEADERS,
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
      targetProductId: {
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
        headers: NO_CACHE_HEADERS,
      },
    );
  }

  const controlVariant =
    experiment.variants.find(
      (variant) => variant.isControl,
    ) ?? null;

  const treatmentVariant =
    experiment.variants.find(
      (variant) => !variant.isControl,
    ) ?? null;

  if (!controlVariant || !treatmentVariant) {
    return Response.json(
      {
        activeExperiment: null,
      },
      {
        headers: NO_CACHE_HEADERS,
      },
    );
  }

  return Response.json(
    {
      activeExperiment: {
        experimentId: experiment.id,
        trackingKey: experiment.trackingKey,
        status: experiment.status,
        productId: experiment.targetProductId,
        variants: [
          {
            id: "control",
            databaseId: controlVariant.id,
            name: controlVariant.name,
            isControl: true,
            titleOverride: null,
          },
          {
            id: "variant-a",
            databaseId: treatmentVariant.id,
            name: treatmentVariant.name,
            isControl: false,
            target:
              treatmentVariant.target ??
              (treatmentVariant.titleOverride
                ? "PRODUCT_TITLE"
                : null),
            changeType:
              treatmentVariant.changeType ??
              (treatmentVariant.titleOverride
                ? "REPLACE_TEXT"
                : null),
            changeValue:
              treatmentVariant.changeValue ??
              treatmentVariant.titleOverride,
            // Legacy compatibility while old title-specific
            // experiments still exist.
            titleOverride: treatmentVariant.titleOverride,
          },
        ],
      },
    },
    {
      headers: NO_CACHE_HEADERS,
    },
  );
};
