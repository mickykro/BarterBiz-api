import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

// Import the main apiRouter which contains all sub-routes
import { apiRouter } from "./routes/index.js";

console.log("[STARTUP] 🚀 BarterBiz API Starting...");

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
});

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Request logger for ALL incoming traffic
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url}`);
  next();
});

// 1. Health check - defined at the very top
app.get("/health", async (_req, res) => {
  console.log("[DEBUG] Health check hit");
  try {
    const { prisma } = await import("./lib/prisma.js");
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, database: "connected" });
  } catch (error: any) {
    console.error("[DEBUG] Health check DB error:", error.message);
    res.status(200).json({ ok: true, database: "disconnected", error: error.message });
  }
});

// 2. Root route
app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, message: "BarterBiz API is live" });
});

// 3. Explicitly Mount API Routes under /api prefix
// This ensures both /auth/login AND /api/auth/login can be supported if desired,
// but standardizing on /api/ is best practice.
console.log("[STARTUP] Mounting API Routes under /api prefix...");
app.use("/api", apiRouter);
// Also mount without prefix to support existing clients if needed
app.use(apiRouter);

// 4. Final 404 Catch-all with Detailed Debugging
app.use((req, res) => {
  console.log(`[DEBUG] ❌ 404 Not Found: ${req.method} ${req.url}`);
  console.log(`[DEBUG] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  res.status(404).json({
    error: "Route Not Found",
    method: req.method,
    path: req.url,
    fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    hint: "If this works locally but not on Railway, check if you are using the correct domain and path prefix (/api/)."
  });
});

// 5. Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR] Server Error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

const PORT = Number(process.env.PORT) || 4000;

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[STARTUP] ✅ Server listening on 0.0.0.0:${PORT}`);
  
  try {
    const { prisma } = await import("./lib/prisma.js");
    await prisma.$connect();
    console.log("[STARTUP] ✅ Database connection successful");
  } catch (error) {
    console.error("[STARTUP] ❌ Database connection failed:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received, closing server...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});
