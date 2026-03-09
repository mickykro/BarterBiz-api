import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const businessSchema = z.object({
  businessName: z.string().min(2),
  category: z.string().min(2),
  description: z.string().min(10),
  locationCity: z.string().min(2),
  locationRegion: z.string().min(2),
  logoUrl: z.string().url().optional(),
});

const serviceSchema = z.object({
  serviceName: z.string().min(2),
  serviceType: z.enum(["offer", "need"]),
  category: z.string().min(2),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const businessRouter = Router();

// Create or update current user's business profile
businessRouter.post("/businesses/me", requireAuth, async (req: AuthRequest, res) => {
  const parsed = businessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.business.findFirst({ where: { userId: req.userId } });
  const data = { ...parsed.data, userId: req.userId as string };

  const business = existing
    ? await prisma.business.update({ where: { id: existing.id }, data })
    : await prisma.business.create({ data });

  res.json(business);
});

businessRouter.get("/businesses/me", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId }, include: { services: true } });
  if (!business) return res.status(404).json({ error: "Business not found" });
  res.json(business);
});

businessRouter.get("/businesses/:id", async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id }, include: { services: true } });
  if (!business || !business.isActive) return res.status(404).json({ error: "Business not found" });
  res.json(business);
});

businessRouter.put("/businesses/me/services", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.array(serviceSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(404).json({ error: "Business not found" });

  const services = await prisma.$transaction(async (tx) => {
    await tx.businessService.deleteMany({ where: { businessId: business.id } });
    return tx.businessService.createMany({
      data: parsed.data.map((s) => ({
        businessId: business.id,
        serviceName: s.serviceName,
        serviceType: s.serviceType,
        category: s.category,
        description: s.description,
        isActive: s.isActive ?? true,
      })),
    });
  });

  res.json({ success: true, count: services.count });
});
