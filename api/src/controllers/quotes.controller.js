const pool = require("../config/db");

async function getQuotes(req, res) {
  const [rows] = await pool.query("SELECT * FROM quotes");
  res.json(
    rows.map((q) => ({
      id: q.id,
      quote: q.quote,
      author: q.author,
      source: q.source,
    }))
  );
}

// must be registered before the "/quotes/:id" route so "random" isn't parsed as an id
async function getRandomQuote(req, res) {
  const [rows] = await pool.query("SELECT * FROM quotes ORDER BY RAND() LIMIT 1");
  if (rows.length === 0) {
    return res.status(404).json({ error: "No quotes found" });
  }
  const q = rows[0];
  res.json({ id: q.id, quote: q.quote, author: q.author, source: q.source });
}

async function getQuoteById(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query("SELECT * FROM quotes WHERE id = ?", [id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }
  const q = rows[0];
  res.json({ id: q.id, quote: q.quote, author: q.author, source: q.source });
}

async function addQuote(req, res) {
  const { quote, author } = req.body;
  const requestedSource = req.body.source;
  if (!quote) {
    return res.status(400).json({ error: "quote is required" });
  }
  if (
    requestedSource !== undefined &&
    requestedSource !== null &&
    (typeof requestedSource !== "string" || requestedSource.length > 255)
  ) {
    return res
      .status(400)
      .json({ error: "source must be a string of at most 255 characters" });
  }
  const source = requestedSource || null;
  const [result] = await pool.query(
    "INSERT INTO quotes (quote, author, source) VALUES (?, ?, ?)",
    [quote, author, source]
  );
  res.status(201).json({ id: result.insertId, quote, author, source });
}

async function updateQuote(req, res) {
  const { id } = req.params;
  const { quote, author } = req.body;
  const requestedSource = req.body.source;
  if (!quote) {
    return res.status(400).json({ error: "quote is required" });
  }
  if (
    requestedSource !== undefined &&
    requestedSource !== null &&
    (typeof requestedSource !== "string" || requestedSource.length > 255)
  ) {
    return res
      .status(400)
      .json({ error: "source must be a string of at most 255 characters" });
  }
  const source = requestedSource || null;
  const sourceProvided = Object.hasOwn(req.body, "source");
  const [result] = sourceProvided
    ? await pool.query(
        "UPDATE quotes SET quote = ?, author = ?, source = ? WHERE id = ?",
        [quote, author, source, id]
      )
    : await pool.query(
        "UPDATE quotes SET quote = ?, author = ? WHERE id = ?",
        [quote, author, id]
      );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }
  res.json({
    id: Number(id),
    quote,
    author,
    ...(sourceProvided ? { source } : {}),
  });
}

async function deleteQuote(req, res) {
  const { id } = req.params;
  const [result] = await pool.query("DELETE FROM quotes WHERE id = ?", [id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }
  res.status(204).send();
}

module.exports = {
  getQuotes,
  getRandomQuote,
  getQuoteById,
  addQuote,
  updateQuote,
  deleteQuote,
};
