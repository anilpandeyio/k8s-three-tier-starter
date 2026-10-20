jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const request = require("supertest");
const pool = require("../src/config/db");
const logger = require("../src/logger");
const app = require("../src/app");

describe("Quotes API", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  describe("GET /api/quotes", () => {
    it("returns the list of quotes", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, quote: "Be the change.", author: "Ghandi", source: "Book" }],
      ]);

      const res = await request(app).get("/api/quotes");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, quote: "Be the change.", author: "Ghandi", source: "Book" },
      ]);
      expect(pool.query).toHaveBeenCalledWith("SELECT * FROM quotes");
    });

    it("logs the propagated trace ID and links to the frontend request", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .get("/api/quotes")
        .set("x-trace-id", "trace-from-frontend")
        .set("x-request-id", "frontend-request-123");

      expect(res.status).toBe(200);
      expect(res.headers["x-trace-id"]).toBe("trace-from-frontend");
      expect(res.headers["x-request-id"]).toMatch(/^[\w-]{36}$/);
      expect(logger.info).toHaveBeenCalledWith(
        "request",
        expect.objectContaining({
          trace_id: "trace-from-frontend",
          request_id: res.headers["x-request-id"],
          parent_request_id: "frontend-request-123",
        })
      );
    });

    it("replaces invalid correlation IDs", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .get("/api/quotes")
        .set("x-trace-id", "invalid/id")
        .set("x-request-id", "invalid/id");

      expect(res.headers["x-trace-id"]).not.toBe("invalid/id");
      expect(res.headers["x-trace-id"]).toMatch(/^[\w-]{36}$/);
      expect(logger.info).toHaveBeenCalledWith(
        "request",
        expect.not.objectContaining({ parent_request_id: "invalid/id" })
      );
    });

    it("filters quotes by source using a parameterized query", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem" }],
      ]);

      const res = await request(app).get("/api/quotes?source=%20Poem%20");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem" },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM quotes WHERE source = ?",
        ["Poem"]
      );
    });

    it("rejects a source filter that is not a string", async () => {
      const res = await request(app).get("/api/quotes?source[]=Poem");

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/quotes/random", () => {
    it("returns a single random quote", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem" }],
      ]);

      const res = await request(app).get("/api/quotes/random");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 2,
        quote: "Carpe diem.",
        author: "Horace",
        source: "Poem",
      });
    });

    it("returns 404 when there are no quotes", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app).get("/api/quotes/random");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/quotes/:id", () => {
    it("returns the matching quote", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 5, quote: "Stay hungry.", author: "Jobs", source: "Speech" }],
      ]);

      const res = await request(app).get("/api/quotes/5");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 5,
        quote: "Stay hungry.",
        author: "Jobs",
        source: "Speech",
      });
    });

    it("returns 404 when the quote doesn't exist", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app).get("/api/quotes/999");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/quotes", () => {
    it("creates a quote and returns 201", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 10 }]);

      const res = await request(app)
        .post("/api/quotes")
        .send({ quote: "New quote", author: "Someone", source: "Book" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 10,
        quote: "New quote",
        author: "Someone",
        source: "Book",
      });
      expect(pool.query).toHaveBeenCalledWith(
        "INSERT INTO quotes (quote, author, source) VALUES (?, ?, ?)",
        ["New quote", "Someone", "Book"]
      );
    });

    it("returns 400 when quote is missing", async () => {
      const res = await request(app).post("/api/quotes").send({ author: "Someone" });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("returns 400 when source is not a string", async () => {
      const res = await request(app)
        .post("/api/quotes")
        .send({ quote: "New quote", source: 123 });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/quotes/:id", () => {
    it("updates an existing quote", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .put("/api/quotes/1")
        .send({ quote: "Updated", author: "Someone", source: "Book" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 1,
        quote: "Updated",
        author: "Someone",
        source: "Book",
      });
      expect(pool.query).toHaveBeenCalledWith(
        "UPDATE quotes SET quote = ?, author = ?, source = ? WHERE id = ?",
        ["Updated", "Someone", "Book", "1"]
      );
    });

    it("returns 404 when the quote doesn't exist", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app)
        .put("/api/quotes/999")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(404);
    });

    it("leaves source unchanged when it is omitted", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .put("/api/quotes/1")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        "UPDATE quotes SET quote = ?, author = ? WHERE id = ?",
        ["Updated", "Someone", "1"]
      );
    });
  });

  describe("DELETE /api/quotes/:id", () => {
    it("deletes an existing quote", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app).delete("/api/quotes/1");

      expect(res.status).toBe(204);
    });

    it("returns 404 when the quote doesn't exist", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app).delete("/api/quotes/999");

      expect(res.status).toBe(404);
    });
  });
});
