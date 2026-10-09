import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import { filingsRouter } from "./routes/filings";
import { summaryRouter } from "./routes/summary";

export const createApp = () => {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/companies", filingsRouter);
  app.use("/filings", summaryRouter);
  app.use(errorHandler);

  return app;
};
