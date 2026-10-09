const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// readiness probe: verifies the DB connection is actually usable, not just that the process is up
router.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "not ready", error: err.message });
  }
});

module.exports = router;
