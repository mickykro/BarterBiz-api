import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { notify } from "../services/notifications.js";

const sendSchema = z.object({
  messageType: z.enum(["text", "image", "link", "system"]).default("text"),
  messageText: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

export const messageRouter = Router();

messageRouter.get("/deals/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  if (deal.businessAId !== business.id && deal.businessBId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 50);
  const messages = await prisma.dealMessage.findMany({
    where: { dealId: deal.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  res.json(messages);
});

messageRouter.post("/deals/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  if (deal.businessAId !== business.id && deal.businessBId !== business.id) return res.status(403).json({ error: "Forbidden" });

  if (parsed.data.messageType === "text" && !parsed.data.messageText) return res.status(400).json({ error: "messageText required" });

  const message = await prisma.dealMessage.create({
    data: {
      dealId: deal.id,
      senderBusinessId: business.id,
      messageType: parsed.data.messageType,
      messageText: parsed.data.messageText,
      mediaUrl: parsed.data.mediaUrl,
    },
  });

  const recipient = business.id === deal.businessAId ? deal.businessBId : deal.businessAId;
  await notify(recipient, {
    type: "message_received",
    title: "New message",
    body: "You received a new deal message",
    relatedEntityType: "deal",
    relatedEntityId: deal.id,
  });

  res.status(201).json(message);
});
