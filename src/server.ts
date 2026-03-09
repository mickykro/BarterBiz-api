import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";

// Global error handlers – catch async crashes after startup
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root route
app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "BarterBiz API is live",
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// API routes
app.use(apiRouter);

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BarterBiz API running on 0.0.0.0:${PORT}`);
});
