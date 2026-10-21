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
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

router.get("/quotes", asyncHandler(getQuotes));
router.get("/quotes/random", asyncHandler(getRandomQuote)); // before "/quotes/:id" so "random" isn't matched as an id
router.get("/quotes/:id", asyncHandler(getQuoteById));
router.post("/quotes", asyncHandler(addQuote));
router.put("/quotes/:id", asyncHandler(updateQuote));
router.delete("/quotes/:id", asyncHandler(deleteQuote));

module.exports = router;
