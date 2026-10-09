jest.mock("axios");

const request = require("supertest");
const axios = require("axios");
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
      data: [{ id: 1, quote: "Be the change.", author: "Ghandi" }],
    });

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Be the change.");
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
      .send({ quote: "New quote", author: "Someone" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
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
      data: { id: 2, quote: "Carpe diem.", author: "Horace" },
    });

    const res = await request(app).get("/quotes/random");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Carpe diem.");
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
    expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/api/quotes/1"));
  });

  it("returns 500 when the API call fails", async () => {
    axios.delete.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).post("/quotes/1/delete");

    expect(res.status).toBe(500);
  });
});
