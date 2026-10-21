const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const axios = require("axios");
const logger = require("./logger");

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function validCorrelationId(value) {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value)
    ? value
    : undefined;
}

function apiRequestConfig(req, config = {}) {
  return {
    ...config,
    headers: {
      ...config.headers,
      "X-Trace-Id": req.traceId,
      "X-Request-Id": req.requestId,
    },
  };
}

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use((req, res, next) => {
  req.traceId = validCorrelationId(req.get("x-trace-id")) || randomUUID();
  req.requestId = randomUUID();
  res.set("X-Trace-Id", req.traceId);
  res.set("X-Request-Id", req.requestId);

  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      trace_id: req.traceId,
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Get the API URL from the environment variable or default to localhost for development
const API_URL = process.env.API_URL || "http://localhost:5001";

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", async (req, res) => {
  const sourceFilter =
    typeof req.query.source === "string" ? req.query.source.trim() : "";
  const tagFilter = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  // GET request to fetch quotes from the API
  try {
    const response = await axios.get(
      `${API_URL}/api/quotes`,
      apiRequestConfig(req, {
        params: {
          ...(sourceFilter ? { source: sourceFilter } : {}),
          ...(tagFilter ? { tag: tagFilter } : {}),
        },
      })
    );
    res.render("index", { quotes: response.data, sourceFilter, tagFilter });
  } catch (err) {
    // Handle the case where the API is down or returning an error
    logger.error(`Unable to fetch quotes. ${err.message}`, {
      trace_id: req.traceId,
      request_id: req.requestId,
    });
    res.render("index", { quotes: [], sourceFilter, tagFilter });
  }
});

app.post("/", async (req, res) => {
  // Post the quote to the API
  const { quote, author, source } = req.body;
  const tags = typeof req.body.tags === "string"
    ? [...new Set(req.body.tags.split(",").map((tag) => tag.trim()).filter(Boolean))]
    : [];
  try {
    const response = await axios.post(`${API_URL}/api/quotes`, {
      quote,
      author,
      source,
      tags,
    }, apiRequestConfig(req));
    if (response.status === 201) {
      return res.redirect("/");
    }
    res.status(500).send("Error: Unable to save quote");
  } catch (err) {
    logger.error(`Unable to save quote. ${err.message}`, {
      trace_id: req.traceId,
      request_id: req.requestId,
    });
    res.status(500).send("Error: Unable to save quote");
  }
});

app.get("/quotes/random", async (req, res) => {
  // Fetch a single random quote from the API
  try {
    const response = await axios.get(
      `${API_URL}/api/quotes/random`,
      apiRequestConfig(req)
    );
    res.render("random", { quote: response.data, error: null });
  } catch (err) {
    logger.error(`Unable to fetch a random quote. ${err.message}`, {
      trace_id: req.traceId,
      request_id: req.requestId,
    });
    res.render("random", { quote: null, error: "No quote available right now." });
  }
});

app.post("/quotes/:id/delete", async (req, res) => {
  // HTML forms can't send DELETE, so proxy it through a POST route
  const { id } = req.params;
  try {
    await axios.delete(
      `${API_URL}/api/quotes/${id}`,
      apiRequestConfig(req)
    );
    res.redirect("/");
  } catch (err) {
    logger.error(`Unable to delete quote ${id}. ${err.message}`, {
      trace_id: req.traceId,
      request_id: req.requestId,
    });
    res.status(500).send("Error: Unable to delete quote");
  }
});

module.exports = app;
