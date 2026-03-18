import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { notify } from "../services/notifications.js";

const createSchema = z.object({
  toBusinessId: z.string().uuid(),
  opportunityId: z.string().uuid().optional(),
  offeredServiceText: z.string().min(3),
  requestedServiceText: z.string().min(3),
  message: z.string().optional(),
});

const counterSchema = z.object({
  offeredServiceText: z.string().min(3).optional(),
  requestedServiceText: z.string().min(3).optional(),
  message: z.string().optional(),
});

export const proposalRouter = Router();

proposalRouter.post("/proposals", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const senderBusiness = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!senderBusiness) return res.status(400).json({ error: "Create a business first" });

  if (senderBusiness.id === parsed.data.toBusinessId) return res.status(400).json({ error: "Cannot send to self" });

  const targetBusiness = await prisma.business.findUnique({ where: { id: parsed.data.toBusinessId } });
  if (!targetBusiness || !targetBusiness.isActive) return res.status(404).json({ error: "Target business not found" });

  if (parsed.data.opportunityId) {
    const opp = await prisma.opportunity.findUnique({ where: { id: parsed.data.opportunityId } });
    if (!opp || opp.status !== "active") return res.status(400).json({ error: "Invalid opportunity" });
    if (opp.businessId !== targetBusiness.id) return res.status(400).json({ error: "Opportunity does not belong to target" });
  }

  const proposal = await prisma.proposal.create({
    data: {
      fromBusinessId: senderBusiness.id,
      toBusinessId: targetBusiness.id,
      opportunityId: parsed.data.opportunityId,
      offeredServiceText: parsed.data.offeredServiceText,
      requestedServiceText: parsed.data.requestedServiceText,
      message: parsed.data.message,
      status: "pending",
    },
  });

  await notify(targetBusiness.id, {
    type: "proposal_received",
    title: "New proposal",
    body: `You received a proposal from ${senderBusiness.businessName}`,
    relatedEntityType: "proposal",
    relatedEntityId: proposal.id,
  });

  res.status(201).json(proposal);
});

proposalRouter.get("/proposals/sent", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposals = await prisma.proposal.findMany({
    where: { fromBusinessId: business.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(proposals);
});

proposalRouter.get("/proposals/received", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposals = await prisma.proposal.findMany({
    where: { toBusinessId: business.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(proposals);
});

proposalRouter.post("/proposals/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });
  if (![`pending`, `countered`].includes(proposal.status)) return res.status(409).json({ error: "Cannot accept this proposal" });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.proposal.update({ where: { id: proposal.id }, data: { status: "accepted" } });

    const deal = await tx.deal.create({
      data: {
        proposalId: proposal.id,
        businessAId: proposal.fromBusinessId,
        businessBId: proposal.toBusinessId,
        serviceADescription: proposal.offeredServiceText,
        serviceBDescription: proposal.requestedServiceText,
        agreementDescription: proposal.message ?? null,
        status: "approved",
      },
    });

    await tx.dealParticipant.createMany({
      data: [
        { dealId: deal.id, businessId: proposal.fromBusinessId },
        { dealId: deal.id, businessId: proposal.toBusinessId },
      ],
    });

    await tx.dealMessage.create({
      data: {
        dealId: deal.id,
        senderBusinessId: proposal.toBusinessId,
        messageType: "system",
        messageText: "Deal created from accepted proposal",
      },
    });

    return { updated, deal };
  });

  await notify(proposal.fromBusinessId, {
    type: "proposal_accepted",
    title: "Proposal accepted",
    body: "Your proposal was accepted and a deal was created",
    relatedEntityType: "deal",
    relatedEntityId: result.deal.id,
  });

  res.json(result.deal);
});

proposalRouter.post("/proposals/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });
  if (![`pending`, `countered`].includes(proposal.status)) return res.status(409).json({ error: "Cannot reject this proposal" });

  const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
  await notify(proposal.fromBusinessId, {
    type: "proposal_rejected",
    title: "Proposal rejected",
    body: "Your proposal was rejected",
    relatedEntityType: "proposal",
    relatedEntityId: proposal.id,
  });
  res.json(updated);
});

proposalRouter.post("/proposals/:id/counter", requireAuth, async (req: AuthRequest, res) => {
  const parsed = counterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });
  if (proposal.status !== "pending") return res.status(409).json({ error: "Cannot counter this proposal" });

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: "countered",
      offeredServiceText: parsed.data.offeredServiceText ?? proposal.offeredServiceText,
      requestedServiceText: parsed.data.requestedServiceText ?? proposal.requestedServiceText,
      message: parsed.data.message ?? proposal.message,
    },
  });

  await notify(proposal.fromBusinessId, {
    type: "proposal_countered",
    title: "Proposal countered",
    body: "Your proposal received a counter offer",
    relatedEntityType: "proposal",
    relatedEntityId: proposal.id,
  });

  res.json(updated);
});

proposalRouter.get("/proposals/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.fromBusinessId !== business.id && proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const messages = await prisma.proposalMessage.findMany({
    where: { proposalId: proposal.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

proposalRouter.post("/proposals/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const { messageText } = req.body;
  if (!messageText || typeof messageText !== "string") return res.status(400).json({ error: "messageText required" });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.fromBusinessId !== business.id && proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const message = await prisma.proposalMessage.create({
    data: {
      proposalId: proposal.id,
      senderBusinessId: business.id,
      messageText,
    },
  });

  const recipientId = business.id === proposal.fromBusinessId ? proposal.toBusinessId : proposal.fromBusinessId;
  await notify(recipientId, {
    type: "message_received",
    title: "New message",
    body: "You received a new message on a proposal",
    relatedEntityType: "proposal",
    relatedEntityId: proposal.id,
  });

  res.status(201).json(message);
});

proposalRouter.get("/proposals/:id/deal", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.fromBusinessId !== business.id && proposal.toBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const deal = await prisma.deal.findFirst({ where: { proposalId: proposal.id } });
  if (!deal) return res.status(404).json({ error: "No deal found for this proposal" });

  res.json(deal);
});

proposalRouter.post("/proposals/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  if (proposal.fromBusinessId !== business.id) return res.status(403).json({ error: "Forbidden" });
  if (![`pending`, `countered`].includes(proposal.status)) return res.status(409).json({ error: "Cannot cancel this proposal" });

  const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "cancelled" } });
  await notify(proposal.toBusinessId, {
    type: "proposal_cancelled",
    title: "Proposal cancelled",
    body: "A proposal sent to you was cancelled",
    relatedEntityType: "proposal",
    relatedEntityId: proposal.id,
  });
  res.json(updated);
});
