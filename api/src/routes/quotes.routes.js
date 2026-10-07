const express = require("express");
const { getQuotes, addQuote } = require("../controllers/quotes.controller");

const router = express.Router();

router.get("/quotes", getQuotes);
router.post("/quotes", addQuote);

module.exports = router;
