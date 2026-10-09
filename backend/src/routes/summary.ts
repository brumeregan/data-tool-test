import { Router } from "express";
import { summaryQuerySchema } from "../schemas";
import { getFilingsSummary } from "../services/summary";

export const summaryRouter = Router();

summaryRouter.get("/summary", async (req, res) => {
  const result = summaryQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const tickers = await getFilingsSummary(result.data.tickers);

  res.status(200).json(tickers);
});
