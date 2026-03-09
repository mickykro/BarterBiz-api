import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import { scoreOpportunity } from "../services/matching.js";

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  needServiceId: z.string().uuid().optional(),
  needServiceText: z.string().optional(),
  offerServiceId: z.string().uuid().optional(),
  offerServiceText: z.string().optional(),
  locationCity: z.string(),
  locationRegion: z.string(),
  visibilityScope: z.enum(["local", "countrywide"]),
});

const updateSchema = createSchema.partial().extend({ status: z.enum(["active", "paused", "closed"]).optional() });

export const opportunityRouter = Router();

opportunityRouter.post("/opportunities", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const opportunity = await prisma.opportunity.create({
    data: {
      ...parsed.data,
      businessId: business.id,
      status: "active",
    },
  });

  res.status(201).json(opportunity);
});

opportunityRouter.put("/opportunities/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: "Not found" });

  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business || opportunity.businessId !== business.id) return res.status(403).json({ error: "Forbidden" });

  const updated = await prisma.opportunity.update({ where: { id: opportunity.id }, data: parsed.data });
  res.json(updated);
});

opportunityRouter.get("/opportunities/home", requireAuth, async (req: AuthRequest, res) => {
  // Simple ordering by recency for MVP; scoring service can be added later
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });

  const opportunities = await prisma.opportunity.findMany({
    where: { status: "active" },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  const sorted = opportunities
    .map((opp) => ({ ...opp, score: scoreOpportunity(business ?? null, opp) }))
    .sort((a, b) => b.score - a.score);

  res.json(sorted);
});

opportunityRouter.get("/opportunities/feed", async (_req, res) => {
  const opportunities = await prisma.opportunity.findMany({
    where: { status: "active" },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  res.json(opportunities);
});

opportunityRouter.get("/opportunities/mine", requireAuth, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: { userId: req.userId } });
  if (!business) return res.status(400).json({ error: "Create a business first" });

  const opportunities = await prisma.opportunity.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } });
  res.json(opportunities);
});

opportunityRouter.get("/opportunities/:id", async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity || opportunity.status !== "active") return res.status(404).json({ error: "Not found" });
  res.json(opportunity);
});

opportunityRouter.get("/opportunities", async (req, res) => {
  const { category, city, region, visibility, sort } = req.query;
  const opportunities = await prisma.opportunity.findMany({
    where: {
      status: "active",
      locationCity: city ? String(city) : undefined,
      locationRegion: region ? String(region) : undefined,
      visibilityScope: visibility ? (visibility as any) : undefined,
    },
    orderBy: sort === "newest" ? { createdAt: "desc" } : undefined,
    take: 100,
  });

  const filtered = category
    ? opportunities.filter((o) => o.needServiceText?.includes(String(category)) || o.offerServiceText?.includes(String(category)))
    : opportunities;

  res.json(filtered);
});
