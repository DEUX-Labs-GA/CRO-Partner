import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const OPPORTUNITY_STATUSES = [
  "RESEARCH_NEEDED",
  "READY_TO_TEST",
  "TESTING",
  "COMPLETED",
  "NOT_PURSUING",
] as const;

type OpportunityStatus =
  (typeof OPPORTUNITY_STATUSES)[number];

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

  const opportunities =
    await prisma.opportunity.findMany({
      where: {
        shop: session.shop,
      },
      orderBy: [
        {
          priorityScore: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

  return {
    opportunities,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

  const formData =
    await request.formData();

  const opportunityId =
    formData.get("opportunityId");

  const nextStatus =
    formData.get("status");

  if (
    typeof opportunityId !== "string" ||
    !opportunityId
  ) {
    throw new Response(
      "Opportunity ID is required",
      {
        status: 400,
      },
    );
  }

  if (
    typeof nextStatus !== "string" ||
    !isOpportunityStatus(nextStatus)
  ) {
    throw new Response(
      "Invalid opportunity status",
      {
        status: 400,
      },
    );
  }

  const opportunity =
    await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        shop: session.shop,
      },
    });

  if (!opportunity) {
    throw new Response(
      "Opportunity not found",
      {
        status: 404,
      },
    );
  }

  await prisma.opportunity.update({
    where: {
      id: opportunity.id,
    },
    data: {
      status: nextStatus,
    },
  });

  return {
    ok: true,
  };
};

export default function RecommendationsPage() {
  const { opportunities } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="CRO Backlog">
      <s-section heading="Prioritized opportunities">
        <s-paragraph>
          Opportunities are sorted by priority score:
          Reach × Impact × Confidence ÷ Effort.
        </s-paragraph>
      </s-section>

      {opportunities.length === 0 ? (
        <s-section heading="No backlog items yet">
          <s-paragraph>
            Detected funnel opportunities can be added
            to this backlog from Analytics.
          </s-paragraph>

          <s-link href="/app/analytics">
            View analytics
          </s-link>
        </s-section>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {opportunities.map(
            (opportunity) => (
              <s-section
                key={opportunity.id}
                heading={opportunity.title}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <Metric
                    label="Priority score"
                    value={
                      opportunity.priorityScore.toFixed(
                        1,
                      )
                    }
                  />

                  <Metric
                    label="Reach"
                    value={opportunity.reach.toLocaleString()}
                  />

                  <Metric
                    label="Impact"
                    value={formatLabel(
                      opportunity.potentialImpact,
                    )}
                  />

                  <Metric
                    label="Confidence"
                    value={formatLabel(
                      opportunity.confidence,
                    )}
                  />

                  <Metric
                    label="Effort"
                    value={opportunity.effort.toFixed(
                      1,
                    )}
                  />
                </div>

                <s-paragraph>
                  <strong>Observation:</strong>{" "}
                  {opportunity.observation}
                </s-paragraph>

                <s-paragraph>
                  <strong>Evidence:</strong>{" "}
                  {opportunity.evidence}
                </s-paragraph>

                <s-paragraph>
                  <strong>Hypothesis:</strong>{" "}
                  {opportunity.hypothesis}
                </s-paragraph>

                <s-paragraph>
                  <strong>Recommendation:</strong>{" "}
                  {opportunity.recommendation}
                </s-paragraph>

                <s-paragraph>
                  Source rule:{" "}
                  {opportunity.sourceRuleId}
                </s-paragraph>

                <s-paragraph>
                  Product:{" "}
                  {opportunity.productId ??
                    "Store-wide"}
                </s-paragraph>

                <Form method="post">
                  <input
                    type="hidden"
                    name="opportunityId"
                    value={opportunity.id}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "end",
                      flexWrap: "wrap",
                      marginTop: "14px",
                    }}
                  >
                    <div>
                      <label
                        htmlFor={`status-${opportunity.id}`}
                        style={{
                          display: "block",
                          fontWeight: 600,
                          marginBottom: "6px",
                        }}
                      >
                        Status
                      </label>

                      <select
                        id={`status-${opportunity.id}`}
                        name="status"
                        defaultValue={
                          opportunity.status
                        }
                        style={{
                          minHeight: "36px",
                          minWidth: "180px",
                          padding: "6px 10px",
                        }}
                      >
                        {OPPORTUNITY_STATUSES.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {formatLabel(
                                status,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <button
                      type="submit"
                      style={{
                        minHeight: "36px",
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Update status
                    </button>
                  </div>
                </Form>
              </s-section>
            ),
          )}
        </div>
      )}
    </s-page>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #dcdcdc",
        borderRadius: "10px",
        padding: "12px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#616161",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "18px",
          fontWeight: 650,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function isOpportunityStatus(
  value: string,
): value is OpportunityStatus {
  return OPPORTUNITY_STATUSES.includes(
    value as OpportunityStatus,
  );
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(
      /(^|_)([a-z])/g,
      (_, prefix, letter) =>
        `${prefix ? " " : ""}${letter.toUpperCase()}`,
    );
}

export const headers: HeadersFunction = (
  headersArgs,
) => {
  return boundary.headers(headersArgs);
};
