import { Router } from "express";
import { filingsQuerySchema } from "../schemas";
import { getFilings } from "../services/filings";

export const filingsRouter = Router();

filingsRouter.get("/:ticker/filings", async (req, res) => {
  const query = filingsQuerySchema.parse(req.query);
  res.json(await getFilings({ ticker: req.params.ticker, ...query }));
});
