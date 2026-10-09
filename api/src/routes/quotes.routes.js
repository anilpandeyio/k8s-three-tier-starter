const express = require("express");
const {
  getQuotes,
  getRandomQuote,
  getQuoteById,
  addQuote,
  updateQuote,
  deleteQuote,
} = require("../controllers/quotes.controller");

const router = express.Router();

router.get("/quotes", getQuotes);
router.get("/quotes/random", getRandomQuote); // before "/quotes/:id" so "random" isn't matched as an id
router.get("/quotes/:id", getQuoteById);
router.post("/quotes", addQuote);
router.put("/quotes/:id", updateQuote);
router.delete("/quotes/:id", deleteQuote);

module.exports = router;
