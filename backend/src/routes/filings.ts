import { Router } from "express";
import { filingsQuerySchema } from "../schemas";
import { getFilings } from "../services/filings";

export const filingsRouter = Router();

filingsRouter.get("/:ticker/filings", async (req, res) => {
  const result = filingsQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const filings = await getFilings({
    ticker: req.params.ticker,
    ...result.data,
  });

  res.status(200).json(filings);
});
