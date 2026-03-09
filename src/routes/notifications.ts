import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const markSchema = z.object({ ids: z.array(z.string().uuid()) });

export const notificationRouter = Router();

notificationRouter.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 50);

  const notifications = await prisma.notification.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  res.json(notifications);
});

notificationRouter.post("/notifications/read", requireAuth, async (req: AuthRequest, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  await prisma.notification.updateMany({ where: { id: { in: parsed.data.ids }, businessId: business.id }, data: { isRead: true } });
  res.json({ success: true });
});

notificationRouter.post("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  await prisma.notification.updateMany({ where: { businessId: business.id }, data: { isRead: true } });
  res.json({ success: true });
});
