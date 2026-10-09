import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("app", () => {
  it("GET /health returns ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown route", async () => {
    const res = await request(createApp()).get("/nope");
    expect(res.status).toBe(404);
  });
});
