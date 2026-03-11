import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";

console.log("[STARTUP] Loading environment configuration...");

// Global error handlers – catch async crashes after startup
process.on("uncaughtException", (err) => {
  console.error("[ERROR] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[ERROR] Unhandled Rejection:", reason);
});

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check - define this FIRST to avoid any middleware issues
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

// Root route
app.get("/", (_req, res) => {
  console.log("[DEBUG] Root route hit");
  res.status(200).json({
    ok: true,
    message: "BarterBiz API is live",
  });
});

// API routes - Explicitly mounting under /api prefix to avoid root-level confusion if needed,
// but for now keeping it as is and adding a debug log to list all routes.
app.use(apiRouter);

// Debug: List all registered routes on startup
function printRoutes(stack: any[], prefix = "") {
  stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(", ").toUpperCase();
      console.log(`[ROUTE] ${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle.stack) {
      printRoutes(layer.handle.stack, prefix + (layer.regexp.source.replace("^\\/", "").replace("\\/?(?=\\/|$)", "") || ""));
    }
  });
}

// 404 Catch-all (to confirm it's Express returning 404)
app.use((req, res) => {
  console.log(`[DEBUG] 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not Found",
    method: req.method,
    url: req.url,
    hint: "If you expect this route to exist, check your route definitions in src/routes/"
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR] Middleware Error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// Use PORT from env or default to 4000
const PORT = Number(process.env.PORT) || 4000;

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[STARTUP] ✅ BarterBiz API running on 0.0.0.0:${PORT}`);
  console.log(`[STARTUP] Database: ${env.databaseUrl.substring(0, 50)}...`);
  
  console.log("[STARTUP] Registered Routes:");
  printRoutes(app._router.stack);
  
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

process.on("SIGINT", () => {
  console.log("[SHUTDOWN] SIGINT received, closing server...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});
