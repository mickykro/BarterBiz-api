import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";

const app = express();

app.use(cors());
app.use(express.json());

// Request logger – helps diagnose Railway routing issues
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root route for basic connectivity test
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "barterbiz-api", port: env.port });
});

app.use(apiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Bind to 0.0.0.0 – required by Railway
app.listen(env.port, "0.0.0.0", () => {
  console.log(`BarterBiz API running on 0.0.0.0:${env.port}`);
});
