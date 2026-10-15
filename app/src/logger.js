const fs = require("fs");
const path = require("path");

// Identifies this service/pod in every log record and in the log filename,
// so multiple replicas writing to the same mounted directory don't collide.
const SERVICE_NAME = process.env.SERVICE_NAME || "quotes-frontend";
const POD_NAME = process.env.HOSTNAME || "local";

// LOG_DIR is only set in Kubernetes (mounted hostPath volume shared with the
// Fluent Bit DaemonSet). When unset (e.g. local dev / docker compose), the
// logger silently falls back to stdout/stderr only.
const LOG_DIR = process.env.LOG_DIR || "";
let logFilePath = null;

if (LOG_DIR) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    logFilePath = path.join(LOG_DIR, `${SERVICE_NAME}-${POD_NAME}.log`);
  } catch (err) {
    console.error(`logger: unable to create LOG_DIR "${LOG_DIR}": ${err.message}`);
  }
}

function write(level, message, meta = {}) {
  const record = {
    time: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    pod: POD_NAME,
    message,
    ...meta,
  };
  const line = JSON.stringify(record);

  // Always emit to stdout/stderr too, so `kubectl logs` keeps working exactly
  // as before, independent of whether LOG_DIR/the volume is mounted.
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }

  if (logFilePath) {
    fs.appendFile(logFilePath, line + "\n", (err) => {
      if (err) {
        console.error(`logger: failed to write to ${logFilePath}: ${err.message}`);
      }
    });
  }
}

module.exports = {
  info: (message, meta) => write("info", message, meta),
  error: (message, meta) => write("error", message, meta),
};
