import { Opportunity, Business } from "@prisma/client";

export function scoreOpportunity(viewer: Business | null, opportunity: Opportunity) {
  let score = 0;
  if (viewer) {
    if (viewer.locationCity === opportunity.locationCity) score += 2;
    if (viewer.locationRegion === opportunity.locationRegion) score += 1;
    score += Math.min(viewer.ratingAvg, 5) * 0.2;
  }

  // Text-based heuristic: prefer opportunities with offer/need text present
  if (opportunity.offerServiceText) score += 1;
  if (opportunity.needServiceText) score += 1;

  // Recency bump
  const hoursOld = (Date.now() - opportunity.createdAt.getTime()) / 36e5;
  score += Math.max(0, 5 - hoursOld * 0.1);

  return score;
}
