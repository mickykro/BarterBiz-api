import { Router } from "express";
import { authRouter } from "./auth.js";
import { businessRouter } from "./business.js";
import { opportunityRouter } from "./opportunities.js";
import { proposalRouter } from "./proposals.js";
import { dealRouter } from "./deals.js";
import { messageRouter } from "./messages.js";
import { ratingRouter } from "./ratings.js";
import { notificationRouter } from "./notifications.js";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(businessRouter);
apiRouter.use(opportunityRouter);
apiRouter.use(proposalRouter);
apiRouter.use(dealRouter);
apiRouter.use(messageRouter);
apiRouter.use(ratingRouter);
apiRouter.use(notificationRouter);

