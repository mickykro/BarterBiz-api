import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { notifyMany } from "../services/notifications.js";

const statusSchema = z.object({ status: z.enum(["approved", "in_progress", "completed", "cancelled", "disputed", "closed"]) });
const participantStatusSchema = z.object({ executionStatus: z.enum(["not_started", "in_progress", "completed"]) });

function canTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    approved: ["in_progress", "cancelled", "disputed", "closed"],
    in_progress: ["completed", "cancelled", "disputed", "closed"],
    completed: ["closed"],
    cancelled: [],
    disputed: ["closed"],
    closed: [],
  };
  return (allowed[from] ?? []).includes(to);
}

export const dealRouter = Router();

async function updateStatus(req: AuthRequest, res: any, overrideStatus?: string) {
  const parsed = statusSchema.safeParse(overrideStatus ? { status: overrideStatus } : req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  if (deal.businessAId !== business.id && deal.businessBId !== business.id) return res.status(403).json({ error: "Forbidden" });

  if (!canTransition(deal.status, parsed.data.status)) return res.status(409).json({ error: "Invalid status transition" });

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "completed" ? new Date() : deal.completedAt,
    },
  });

  await notifyMany(
    [deal.businessAId, deal.businessBId].filter((b) => b !== business.id),
    {
      type: "deal_status",
      title: "Deal status updated",
      body: `Deal is now ${parsed.data.status}`,
      relatedEntityType: "deal",
      relatedEntityId: deal.id,
    }
  );

  return res.json(updated);
}

dealRouter.get("/deals", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deals = await prisma.deal.findMany({
    where: {
      OR: [{ businessAId: business.id }, { businessBId: business.id }],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(deals);
});

dealRouter.get("/deals/:id", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: { participants: true } });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  if (deal.businessAId !== business.id && deal.businessBId !== business.id) return res.status(403).json({ error: "Forbidden" });

  res.json(deal);
});

dealRouter.post("/deals/:id/status", requireAuth, (req: AuthRequest, res) => updateStatus(req, res));

dealRouter.post("/deals/:id/participants/:participantId/status", requireAuth, async (req: AuthRequest, res) => {
  const parsed = participantStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const participant = await prisma.dealParticipant.findUnique({ where: { id: req.params.participantId }, include: { deal: true } });
  if (!participant) return res.status(404).json({ error: "Participant not found" });
  if (participant.businessId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const next = parsed.data.executionStatus;
  const allowed: Record<string, string[]> = {
    not_started: ["in_progress"],
    in_progress: ["completed"],
    completed: [],
  };
  if (!(allowed[participant.executionStatus] ?? []).includes(next)) return res.status(409).json({ error: "Invalid participant transition" });

  const updatedParticipant = await prisma.dealParticipant.update({
    where: { id: participant.id },
    data: {
      executionStatus: next,
      markedCompletedAt: next === "completed" ? new Date() : participant.markedCompletedAt,
    },
  });

  // If both participants completed, complete the deal
  const participants = await prisma.dealParticipant.findMany({ where: { dealId: participant.dealId } });
  const allCompleted = participants.every((p) => p.executionStatus === "completed");
  if (allCompleted && participant.deal.status !== "completed") {
    await prisma.deal.update({ where: { id: participant.dealId }, data: { status: "completed", completedAt: new Date() } });
    await notifyMany(
      [participant.deal.businessAId, participant.deal.businessBId],
      {
        type: "deal_completed",
        title: "Deal completed",
        body: "Both participants marked completed",
        relatedEntityType: "deal",
        relatedEntityId: participant.dealId,
      }
    );
  }

  res.json(updatedParticipant);
});

dealRouter.post("/deals/:id/dispute", requireAuth, async (req: AuthRequest, res) => {
  return updateStatus(req, res, "disputed");
});

dealRouter.post("/deals/:id/close", requireAuth, async (req: AuthRequest, res) => {
  return updateStatus(req, res, "closed");
});
