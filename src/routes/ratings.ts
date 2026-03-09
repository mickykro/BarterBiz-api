import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const ratingSchema = z.object({
  qualityScore: z.number().int().min(1).max(5),
  reliabilityScore: z.number().int().min(1).max(5),
  communicationScore: z.number().int().min(1).max(5),
  reviewText: z.string().optional(),
});

export const ratingRouter = Router();

ratingRouter.post("/deals/:id/ratings", requireAuth, async (req: AuthRequest, res) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  if (deal.businessAId !== business.id && deal.businessBId !== business.id) return res.status(403).json({ error: "Forbidden" });
  if (deal.status !== "completed") return res.status(409).json({ error: "Deal not completed" });

  const toBusinessId = business.id === deal.businessAId ? deal.businessBId : deal.businessAId;

  try {
    const rating = await prisma.$transaction(async (tx) => {
      const created = await tx.rating.create({
        data: {
          dealId: deal.id,
          fromBusinessId: business.id,
          toBusinessId,
          qualityScore: parsed.data.qualityScore,
          reliabilityScore: parsed.data.reliabilityScore,
          communicationScore: parsed.data.communicationScore,
          reviewText: parsed.data.reviewText,
        },
      });

      // Aggregate rating into business
      const agg = await tx.rating.aggregate({
        _avg: { qualityScore: true, reliabilityScore: true, communicationScore: true },
        _count: true,
        where: { toBusinessId },
      });

      const avg = ((agg._avg.qualityScore ?? 0) + (agg._avg.reliabilityScore ?? 0) + (agg._avg.communicationScore ?? 0)) / 3;
      await tx.business.update({ where: { id: toBusinessId }, data: { ratingAvg: avg, ratingCount: agg._count } });

      return created;
    });

    res.status(201).json(rating);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "Already rated" });
    throw err;
  }
});

ratingRouter.get("/businesses/:id/ratings", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  const ratings = await prisma.rating.findMany({
    where: { toBusinessId: req.params.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  res.json(ratings);
});
