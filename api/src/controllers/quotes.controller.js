const pool = require("../config/db");

async function getQuotes(req, res) {
  const [rows] = await pool.query("SELECT * FROM quotes");
  res.json(rows.map((q) => ({ id: q.id, quote: q.quote, author: q.author })));
}

async function addQuote(req, res) {
  const { quote, author } = req.body;
  const [result] = await pool.query(
    "INSERT INTO quotes (quote, author) VALUES (?, ?)",
    [quote, author]
  );
  res.status(201).json({ id: result.insertId, quote, author });
}

module.exports = { getQuotes, addQuote };
