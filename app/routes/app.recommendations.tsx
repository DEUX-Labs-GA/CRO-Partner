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
import {
  calculateOpportunityPriority,
} from "../services/opportunity-prioritization";

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

  const intent =
    formData.get("intent");

  if (intent === "create-opportunity") {
    const title =
      formData.get("title");

    const observation =
      formData.get("observation");

    const evidence =
      formData.get("evidence");

    const hypothesis =
      formData.get("hypothesis");

    const recommendation =
      formData.get("recommendation");

    const confidence =
      formData.get("confidence");

    const impact =
      formData.get("impact");

    const reach =
      Number(formData.get("reach"));

    const effort =
      Number(formData.get("effort"));

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof observation !== "string" ||
      !observation.trim() ||
      typeof evidence !== "string" ||
      !evidence.trim() ||
      typeof hypothesis !== "string" ||
      !hypothesis.trim() ||
      typeof recommendation !== "string" ||
      !recommendation.trim()
    ) {
      throw new Response(
        "Required opportunity fields are missing",
        {
          status: 400,
        },
      );
    }

    if (
      confidence !== "LOW" &&
      confidence !== "MEDIUM" &&
      confidence !== "HIGH"
    ) {
      throw new Response(
        "Invalid confidence",
        {
          status: 400,
        },
      );
    }

    if (
      impact !== "LOW" &&
      impact !== "MEDIUM" &&
      impact !== "HIGH"
    ) {
      throw new Response(
        "Invalid impact",
        {
          status: 400,
        },
      );
    }

    const priority =
      calculateOpportunityPriority({
        reach,
        impact,
        confidence,
        effort,
      });

    await prisma.opportunity.create({
      data: {
        shop: session.shop,
        sourceRuleId: "MANUAL",
        productId: null,
        title: title.trim(),
        observation:
          observation.trim(),
        evidence: evidence.trim(),
        hypothesis:
          hypothesis.trim(),
        recommendation:
          recommendation.trim(),
        confidence,
        potentialImpact: impact,
        reach: priority.reach,
        impactScore:
          priority.impactScore,
        confidenceScore:
          priority.confidenceScore,
        effort: priority.effort,
        priorityScore:
          priority.priorityScore,
      },
    });

    return {
      ok: true,
    };
  }

  if (intent !== "update-status") {
    throw new Response(
      "Invalid action",
      {
        status: 400,
      },
    );
  }

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
      <s-section heading="Create opportunity">
        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="create-opportunity"
          />

          <div
            style={{
              display: "grid",
              gap: "12px",
              maxWidth: "760px",
            }}
          >
            <label>
              Title
              <input
                name="title"
                required
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "4px",
                  minHeight: "36px",
                }}
              />
            </label>

            <label>
              Observation
              <textarea
                name="observation"
                required
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "4px",
                }}
              />
            </label>

            <label>
              Evidence
              <textarea
                name="evidence"
                required
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "4px",
                }}
              />
            </label>

            <label>
              Hypothesis
              <textarea
                name="hypothesis"
                required
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "4px",
                }}
              />
            </label>

            <label>
              Recommendation
              <textarea
                name="recommendation"
                required
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "4px",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <label>
                Reach
                <input
                  type="number"
                  name="reach"
                  min="0"
                  defaultValue="10"
                  required
                />
              </label>

              <label>
                Impact
                <select
                  name="impact"
                  defaultValue="MEDIUM"
                >
                  <option value="LOW">
                    Low
                  </option>
                  <option value="MEDIUM">
                    Medium
                  </option>
                  <option value="HIGH">
                    High
                  </option>
                </select>
              </label>

              <label>
                Confidence
                <select
                  name="confidence"
                  defaultValue="MEDIUM"
                >
                  <option value="LOW">
                    Low
                  </option>
                  <option value="MEDIUM">
                    Medium
                  </option>
                  <option value="HIGH">
                    High
                  </option>
                </select>
              </label>

              <label>
                Effort
                <input
                  type="number"
                  name="effort"
                  min="0.5"
                  step="0.5"
                  defaultValue="2"
                  required
                />
              </label>
            </div>

            <div>
              <button
                type="submit"
                style={{
                  minHeight: "36px",
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                Add to CRO backlog
              </button>
            </div>
          </div>
        </Form>
      </s-section>
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

                  <input
                    type="hidden"
                    name="intent"
                    value="update-status"
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
