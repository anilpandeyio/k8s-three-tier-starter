const express = require("express");
const quotesRoutes = require("./routes/quotes.routes");
const healthRoutes = require("./routes/health.routes");
const logger = require("./logger");

const app = express();
app.use(express.json());

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

app.use("/api", quotesRoutes);
app.use("/", healthRoutes);

module.exports = app;
