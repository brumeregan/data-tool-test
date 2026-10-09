import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { EdgarUnavailable, TickerNotFound } from "../errors";

type ErrorBody = { error: { code: string; message: string } };

const describe = (error: unknown): { status: number; body: ErrorBody } => {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
      .join("; ");
    return { status: 400, body: { error: { code: "INVALID_QUERY", message } } };
  }
  if (error instanceof TickerNotFound) {
    return { status: 404, body: { error: { code: "TICKER_NOT_FOUND", message: error.message } } };
  }
  if (error instanceof EdgarUnavailable) {
    return { status: 502, body: { error: { code: "EDGAR_UNAVAILABLE", message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
  };
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, body } = describe(error);
  if (status === 500) console.error(error);
  res.status(status).json(body);
};
