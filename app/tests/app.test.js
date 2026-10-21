jest.mock("axios");
jest.mock("../src/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const request = require("supertest");
const axios = require("axios");
const logger = require("../src/logger");
const app = require("../src/app");

describe("GET /health", () => {
  it("returns 200 OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });
});

describe("GET /", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders quotes returned by the API", async () => {
    axios.get.mockResolvedValueOnce({
      data: [{
        id: 1,
        quote: "Be the change.",
        author: "Ghandi",
        source: "Book",
        tags: ["wisdom", "life"],
      }],
    });

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Be the change.");
    expect(res.text).toContain("Source: Book");
    expect(res.text).toContain("Tags: wisdom, life");
  });

  it("forwards a source filter to the API and keeps it in the input", async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 2, quote: "Carpe diem.", author: "Horace", source: "Poem" }],
    });

    const res = await request(app).get("/?source=%20Poem%20");

    expect(res.status).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/quotes"),
      {
        params: { source: "Poem" },
        headers: {
          "X-Trace-Id": expect.any(String),
          "X-Request-Id": expect.any(String),
        },
      }
    );
    expect(res.text).toContain('value="Poem"');
    expect(res.text).toContain("Carpe diem.");
  });

  it("forwards a tag filter to the API and displays quote tags", async () => {
    axios.get.mockResolvedValueOnce({
      data: [{
        id: 3,
        quote: "Keep going.",
        author: "Unknown",
        source: null,
        tags: ["motivation"],
      }],
    });

    const res = await request(app).get("/?tag=%20motivation%20");

    expect(res.status).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/quotes"),
      expect.objectContaining({ params: { tag: "motivation" } })
    );
    expect(res.text).toContain('value="motivation"');
    expect(res.text).toContain("Tags: motivation");
  });

  it("propagates trace IDs and logs a service request ID", async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const res = await request(app).get("/").set("x-trace-id", "trace-from-client");

    expect(res.headers["x-trace-id"]).toBe("trace-from-client");
    expect(res.headers["x-request-id"]).toMatch(/^[\w-]{36}$/);
    const [, config] = axios.get.mock.calls[0];
    expect(config.headers).toEqual({
      "X-Trace-Id": "trace-from-client",
      "X-Request-Id": res.headers["x-request-id"],
    });
    expect(logger.info).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        trace_id: "trace-from-client",
        request_id: res.headers["x-request-id"],
      })
    );
  });

  it("replaces an invalid incoming trace ID", async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const res = await request(app).get("/").set("x-trace-id", "invalid/id");

    expect(res.headers["x-trace-id"]).not.toBe("invalid/id");
    expect(res.headers["x-trace-id"]).toMatch(/^[\w-]{36}$/);
  });

  it("renders an empty list when the API is unreachable", async () => {
    axios.get.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("No quotes yet");
  });
});

describe("POST /", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("redirects home after successfully saving a quote", async () => {
    axios.post.mockResolvedValueOnce({ status: 201 });

    const res = await request(app)
      .post("/")
      .type("form")
      .send({ quote: "New quote", author: "Someone" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/quotes"),
      { quote: "New quote", author: "Someone", source: undefined, tags: [] },
      {
        headers: {
          "X-Trace-Id": res.headers["x-trace-id"],
          "X-Request-Id": res.headers["x-request-id"],
        },
      }
    );
  });

  it("splits, trims, and de-duplicates the tags field", async () => {
    axios.post.mockResolvedValueOnce({ status: 201 });

    const res = await request(app)
      .post("/")
      .type("form")
      .send({ quote: "New quote", tags: " wisdom, life, wisdom ,, " });

    expect(res.status).toBe(302);
    expect(axios.post.mock.calls[0][1]).toEqual({
      quote: "New quote",
      author: undefined,
      source: undefined,
      tags: ["wisdom", "life"],
    });
  });

  it("returns 500 when the API call fails", async () => {
    axios.post.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app)
      .post("/")
      .send({ quote: "New quote", author: "Someone" });

    expect(res.status).toBe(500);
  });
});

describe("GET /quotes/random", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders the random quote returned by the API", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 2,
        quote: "Carpe diem.",
        author: "Horace",
        source: "Poem",
        tags: ["wisdom"],
      },
    });

    const res = await request(app).get("/quotes/random");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Carpe diem.");
    expect(res.text).toContain("Source: Poem");
    expect(res.text).toContain("Tags: wisdom");
  });

  it("renders an error message when the API call fails", async () => {
    axios.get.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/quotes/random");

    expect(res.status).toBe(200);
    expect(res.text).toContain("No quote available right now.");
  });
});

describe("POST /quotes/:id/delete", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("redirects home after deleting a quote", async () => {
    axios.delete.mockResolvedValueOnce({ status: 204 });

    const res = await request(app).post("/quotes/1/delete");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining("/api/quotes/1"),
      {
        headers: {
          "X-Trace-Id": res.headers["x-trace-id"],
          "X-Request-Id": res.headers["x-request-id"],
        },
      }
    );
  });

  it("returns 500 when the API call fails", async () => {
    axios.delete.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).post("/quotes/1/delete");

    expect(res.status).toBe(500);
  });
});
