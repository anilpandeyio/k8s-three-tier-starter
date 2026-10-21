jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const request = require("supertest");
const pool = require("../src/config/db");
const logger = require("../src/logger");
const app = require("../src/app");
const connection = {
  query: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

describe("Quotes API", () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
    connection.query.mockReset().mockResolvedValue([[]]);
    connection.beginTransaction.mockReset().mockResolvedValue(undefined);
    connection.commit.mockReset().mockResolvedValue(undefined);
    connection.rollback.mockReset().mockResolvedValue(undefined);
    connection.release.mockReset();
    pool.getConnection = jest.fn().mockResolvedValue(connection);
  });

  describe("GET /api/quotes", () => {
    it("returns the list of quotes", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, quote: "Be the change.", author: "Ghandi", source: "Book" }],
      ]);

      const res = await request(app).get("/api/quotes");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, quote: "Be the change.", author: "Ghandi", source: "Book", tags: [] },
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
        { id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem", tags: [] },
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

    it("filters by tag and returns tags with each quote", async () => {
      pool.query
        .mockResolvedValueOnce([
          [{ id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem" }],
        ])
        .mockResolvedValueOnce([[{ quote_id: 2, tag: "wisdom" }]]);

      const res = await request(app).get("/api/quotes?tag=%20wisdom%20");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: 2,
          quote: "Carpe diem.",
          author: "Horace",
          source: "Poem",
          tags: ["wisdom"],
        },
      ]);
      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM quotes WHERE EXISTS (SELECT 1 FROM quote_tags WHERE quote_tags.quote_id = quotes.id AND quote_tags.tag = ?)",
        ["wisdom"]
      );
    });

    it("rejects a tag filter that is not a string", async () => {
      const res = await request(app).get("/api/quotes?tag[]=wisdom");

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
        tags: [],
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
        tags: [],
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
      connection.query.mockResolvedValueOnce([{ insertId: 10 }]);

      const res = await request(app)
        .post("/api/quotes")
        .send({ quote: "New quote", author: "Someone", source: "Book", tags: ["wisdom"] });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 10,
        quote: "New quote",
        author: "Someone",
        source: "Book",
        tags: ["wisdom"],
      });
      expect(connection.query).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO quotes (quote, author, source) VALUES (?, ?, ?)",
        ["New quote", "Someone", "Book"]
      );
      expect(connection.query).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO quote_tags (quote_id, tag) VALUES (?, ?)",
        [10, "wisdom"]
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
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

    it("rejects malformed tags before writing to the database", async () => {
      const res = await request(app)
        .post("/api/quotes")
        .send({ quote: "New quote", tags: "wisdom" });

      expect(res.status).toBe(400);
      expect(pool.getConnection).not.toHaveBeenCalled();
    });

    it("rolls back and returns a server error when tag persistence fails", async () => {
      connection.query
        .mockResolvedValueOnce([{ insertId: 10 }])
        .mockRejectedValueOnce(new Error("tag insert failed"));

      const res = await request(app)
        .post("/api/quotes")
        .send({ quote: "New quote", tags: ["wisdom"] });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error" });
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Request failed. tag insert failed",
        expect.objectContaining({ trace_id: expect.any(String) })
      );
    });
  });

  describe("PUT /api/quotes/:id", () => {
    it("updates an existing quote", async () => {
      connection.query
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

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
      expect(connection.query).toHaveBeenCalledWith(
        "UPDATE quotes SET quote = ?, author = ?, source = ? WHERE id = ?",
        ["Updated", "Someone", "Book", "1"]
      );
      expect(connection.commit).toHaveBeenCalled();
    });

    it("returns 404 when the quote doesn't exist", async () => {
      const res = await request(app)
        .put("/api/quotes/999")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(404);
      expect(connection.rollback).toHaveBeenCalled();
    });

    it("leaves source unchanged when it is omitted", async () => {
      connection.query
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .put("/api/quotes/1")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(200);
      expect(connection.query).toHaveBeenCalledWith(
        "UPDATE quotes SET quote = ?, author = ? WHERE id = ?",
        ["Updated", "Someone", "1"]
      );
    });

    it("replaces tags only when the tags field is provided", async () => {
      connection.query
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const res = await request(app)
        .put("/api/quotes/1")
        .send({ quote: "Updated", author: "Someone", tags: [" life ", "wisdom", "life"] });

      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual(["life", "wisdom"]);
      expect(connection.query).toHaveBeenCalledWith(
        "INSERT INTO quote_tags (quote_id, tag) VALUES (?, ?), (?, ?)",
        ["1", "life", "1", "wisdom"]
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
