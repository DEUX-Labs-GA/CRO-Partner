import prisma from "../db.server";
import type {
  FunnelOpportunity,
} from "./opportunity-detection.server";
import {
  calculateOpportunityPriority,
} from "./opportunity-prioritization";

export const DEFAULT_OPPORTUNITY_EFFORT = 2;

const ACTIVE_STATUSES = [
  "RESEARCH_NEEDED",
  "READY_TO_TEST",
  "TESTING",
] as const;

export async function saveDetectedOpportunity({
  shop,
  productId,
  opportunity,
  effort = DEFAULT_OPPORTUNITY_EFFORT,
}: {
  shop: string;
  productId: string | null;
  opportunity: FunnelOpportunity;
  effort?: number;
}) {
  const priority =
    calculateOpportunityPriority({
      reach:
        opportunity.potentialImpact
          .affectedVisitors,
      impact:
        opportunity.potentialImpact.level,
      confidence: opportunity.confidence,
      effort,
    });

  /*
   * Avoid creating duplicate active backlog items when
   * the same rule is detected repeatedly for the same product.
   *
   * Completed / Not Pursuing items are intentionally excluded,
   * allowing the same issue to be detected again in the future.
   */
  const existing =
    await prisma.opportunity.findFirst({
      where: {
        shop,
        sourceRuleId: opportunity.ruleId,
        productId,
        status: {
          in: [...ACTIVE_STATUSES],
        },
      },
    });

  const data = {
    title: opportunity.title,
    observation: opportunity.observation,
    evidence: opportunity.evidence,
    hypothesis: opportunity.hypothesis,
    recommendation:
      opportunity.recommendation,
    confidence: opportunity.confidence,
    potentialImpact:
      opportunity.potentialImpact.level,
    reach: priority.reach,
    impactScore: priority.impactScore,
    confidenceScore:
      priority.confidenceScore,
    effort: priority.effort,
    priorityScore:
      priority.priorityScore,
  };

  if (existing) {
    return prisma.opportunity.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.opportunity.create({
    data: {
      shop,
      sourceRuleId: opportunity.ruleId,
      productId,
      ...data,
    },
  });
}
