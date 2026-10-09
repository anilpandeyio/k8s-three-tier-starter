jest.mock("../src/config/db", () => ({ query: jest.fn() }));

const request = require("supertest");
const pool = require("../src/config/db");
const app = require("../src/app");

describe("GET /health", () => {
  it("returns 200 OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });
});

describe("GET /ready", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it("returns 200 when the database responds", async () => {
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]);
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("returns 503 when the database is unreachable", async () => {
    pool.query.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not ready");
  });
});
