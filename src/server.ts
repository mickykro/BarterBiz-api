import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(apiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`BarterBiz API running on port ${env.port}`);
});
