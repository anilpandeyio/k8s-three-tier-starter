const path = require("path");
const express = require("express");
const axios = require("axios");
const logger = require("./logger");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Structured per-request access log, written to stdout and (when mounted)
// the shared log file that Fluent Bit tails.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

// Get the API URL from the environment variable or default to localhost for development
const API_URL = process.env.API_URL || "http://localhost:5001";

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", async (req, res) => {
  // GET request to fetch quotes from the API
  try {
    const response = await axios.get(`${API_URL}/api/quotes`);
    res.render("index", { quotes: response.data });
  } catch (err) {
    // Handle the case where the API is down or returning an error
    logger.error(`Unable to fetch quotes. ${err.message}`);
    res.render("index", { quotes: [] });
  }
});

app.post("/", async (req, res) => {
  // Post the quote to the API
  const { quote, author } = req.body;
  try {
    const response = await axios.post(`${API_URL}/api/quotes`, {
      quote,
      author,
    });
    if (response.status === 201) {
      return res.redirect("/");
    }
    res.status(500).send("Error: Unable to save quote");
  } catch (err) {
    logger.error(`Unable to save quote. ${err.message}`);
    res.status(500).send("Error: Unable to save quote");
  }
});

app.get("/quotes/random", async (req, res) => {
  // Fetch a single random quote from the API
  try {
    const response = await axios.get(`${API_URL}/api/quotes/random`);
    res.render("random", { quote: response.data, error: null });
  } catch (err) {
    logger.error(`Unable to fetch a random quote. ${err.message}`);
    res.render("random", { quote: null, error: "No quote available right now." });
  }
});

app.post("/quotes/:id/delete", async (req, res) => {
  // HTML forms can't send DELETE, so proxy it through a POST route
  const { id } = req.params;
  try {
    await axios.delete(`${API_URL}/api/quotes/${id}`);
    res.redirect("/");
  } catch (err) {
    logger.error(`Unable to delete quote ${id}. ${err.message}`);
    res.status(500).send("Error: Unable to delete quote");
  }
});

module.exports = app;
