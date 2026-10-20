const { randomUUID } = require("crypto");
const express = require("express");
const quotesRoutes = require("./routes/quotes.routes");
const healthRoutes = require("./routes/health.routes");
const logger = require("./logger");

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function validCorrelationId(value) {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value)
    ? value
    : undefined;
}

const app = express();

app.use((req, res, next) => {
  req.traceId = validCorrelationId(req.get("x-trace-id")) || randomUUID();
  req.requestId = randomUUID();
  req.parentRequestId = validCorrelationId(req.get("x-request-id"));
  res.set("X-Trace-Id", req.traceId);
  res.set("X-Request-Id", req.requestId);

  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      trace_id: req.traceId,
      request_id: req.requestId,
      ...(req.parentRequestId ? { parent_request_id: req.parentRequestId } : {}),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

app.use(express.json());
app.use("/api", quotesRoutes);
app.use("/", healthRoutes);

module.exports = app;
