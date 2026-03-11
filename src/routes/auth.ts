import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  locationCity: z.string().optional(),
  locationRegion: z.string().optional(),
  servicesOffered: z.string().optional(),
  servicesNeeded: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, fullName, businessName, category, description, locationCity, locationRegion, servicesOffered, servicesNeeded } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user + business + services in a single transaction
  const { user, business } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash, fullName } });
    const business = await tx.business.create({
      data: {
        userId: user.id,
        businessName: businessName || fullName,
        category: category || "",
        description: description || "",
        locationCity: locationCity || "",
        locationRegion: locationRegion || "",
      },
    });

    // Handle services if provided
    if (servicesOffered) {
      const offered = servicesOffered.split(',').map(s => s.trim()).filter(Boolean);
      for (const serviceName of offered) {
        await tx.businessService.create({
          data: {
            businessId: business.id,
            serviceName,
            serviceType: 'offer',
            category: category || "",
          }
        });
      }
    }

    if (servicesNeeded) {
      const needed = servicesNeeded.split(',').map(s => s.trim()).filter(Boolean);
      for (const serviceName of needed) {
        await tx.businessService.create({
          data: {
            businessId: business.id,
            serviceName,
            serviceType: 'need',
            category: category || "",
          }
        });
      }
    }

    return { user, business };
  });

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "7d" });

  res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
});

authRouter.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, email: user.email, fullName: user.fullName });
});

authRouter.post("/auth/logout", (_req, res) => {
  // Stateless JWT; clients should discard token. Included for contract completeness.
  res.json({ success: true });
});
