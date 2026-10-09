import { Router } from "express";
import { summaryQuerySchema } from "../schemas";
import { getFilingsSummary } from "../services/summary";

export const summaryRouter = Router();

// Errors (including zod failures and AllTickersFailed) propagate to the error middleware.
summaryRouter.get("/summary", async (req, res) => {
  const { tickers } = summaryQuerySchema.parse(req.query);
  res.json(await getFilingsSummary(tickers));
});
