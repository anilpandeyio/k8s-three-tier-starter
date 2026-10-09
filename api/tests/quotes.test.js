jest.mock("../src/config/db", () => ({ query: jest.fn() }));

const request = require("supertest");
const pool = require("../src/config/db");
const app = require("../src/app");

describe("Quotes API", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  describe("GET /api/quotes", () => {
    it("returns the list of quotes", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, quote: "Be the change.", author: "Ghandi" }],
      ]);

      const res = await request(app).get("/api/quotes");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, quote: "Be the change.", author: "Ghandi" },
      ]);
    });
  });

  describe("GET /api/quotes/random", () => {
    it("returns a single random quote", async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 2, quote: "Carpe diem.", author: "Horace" }],
      ]);

      const res = await request(app).get("/api/quotes/random");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 2, quote: "Carpe diem.", author: "Horace" });
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
        [{ id: 5, quote: "Stay hungry.", author: "Jobs" }],
      ]);

      const res = await request(app).get("/api/quotes/5");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 5, quote: "Stay hungry.", author: "Jobs" });
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
        .send({ quote: "New quote", author: "Someone" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 10, quote: "New quote", author: "Someone" });
    });

    it("returns 400 when quote is missing", async () => {
      const res = await request(app).post("/api/quotes").send({ author: "Someone" });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/quotes/:id", () => {
    it("updates an existing quote", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .put("/api/quotes/1")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, quote: "Updated", author: "Someone" });
    });

    it("returns 404 when the quote doesn't exist", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app)
        .put("/api/quotes/999")
        .send({ quote: "Updated", author: "Someone" });

      expect(res.status).toBe(404);
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
