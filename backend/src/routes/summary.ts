import { Router } from "express";
import { summaryQuerySchema } from "../schemas";
import { getFilingsSummary } from "../services/summary";

export const summaryRouter = Router();

summaryRouter.get("/summary", async (req, res) => {
  const { tickers } = summaryQuerySchema.parse(req.query);
  res.json(await getFilingsSummary(tickers));
});
