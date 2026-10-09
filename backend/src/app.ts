import express from "express";

export const createApp = () => {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
};
