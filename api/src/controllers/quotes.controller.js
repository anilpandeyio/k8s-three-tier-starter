const pool = require("../config/db");

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 100;

function parseTags(value) {
  if (value === undefined) {
    return { tags: undefined };
  }
  if (!Array.isArray(value)) {
    return { error: "tags must be an array of strings" };
  }
  if (
    value.some(
      (tag) =>
        typeof tag !== "string" || tag.trim().length === 0 || tag.trim().length > MAX_TAG_LENGTH
    )
  ) {
    return { error: `each tag must be a non-empty string of at most ${MAX_TAG_LENGTH} characters` };
  }

  const tags = [...new Map(value.map((tag) => [tag.trim().toLowerCase(), tag.trim()])).values()];
  if (tags.length > MAX_TAGS) {
    return { error: `tags must contain no more than ${MAX_TAGS} items` };
  }
  return { tags };
}

async function attachTags(quotes, query = pool.query.bind(pool)) {
  if (quotes.length === 0) {
    return [];
  }
  const placeholders = quotes.map(() => "?").join(", ");
  const [tagRows] = await query(
    `SELECT quote_id, tag FROM quote_tags WHERE quote_id IN (${placeholders})`,
    quotes.map((quote) => quote.id)
  );
  const tagsByQuote = new Map(quotes.map((quote) => [quote.id, []]));
  for (const row of tagRows) {
    tagsByQuote.get(row.quote_id)?.push(row.tag);
  }
  return quotes.map((quote) => ({
    ...quote,
    tags: tagsByQuote.get(quote.id) || [],
  }));
}

async function replaceTags(connection, quoteId, tags) {
  await connection.query("DELETE FROM quote_tags WHERE quote_id = ?", [quoteId]);
  await insertTags(connection, quoteId, tags);
}

async function insertTags(connection, quoteId, tags) {
  if (tags.length === 0) {
    return;
  }
  const values = tags.map(() => "(?, ?)").join(", ");
  const parameters = tags.flatMap((tag) => [quoteId, tag]);
  await connection.query(
    `INSERT INTO quote_tags (quote_id, tag) VALUES ${values}`,
    parameters
  );
}

async function getQuotes(req, res) {
  const requestedSource = req.query.source;
  const requestedTag = req.query.tag;
  if (
    requestedSource !== undefined &&
    (typeof requestedSource !== "string" || requestedSource.length > 255)
  ) {
    return res
      .status(400)
      .json({ error: "source must be a string of at most 255 characters" });
  }
  if (
    requestedTag !== undefined &&
    (typeof requestedTag !== "string" || requestedTag.trim().length > MAX_TAG_LENGTH)
  ) {
    return res
      .status(400)
      .json({ error: `tag must be a string of at most ${MAX_TAG_LENGTH} characters` });
  }

  const filters = [];
  const parameters = [];
  const source = requestedSource?.trim();
  const tag = requestedTag?.trim();
  if (source) {
    filters.push("source = ?");
    parameters.push(source);
  }
  if (tag) {
    filters.push(
      "EXISTS (SELECT 1 FROM quote_tags WHERE quote_tags.quote_id = quotes.id AND quote_tags.tag = ?)"
    );
    parameters.push(tag);
  }
  const sql = `SELECT * FROM quotes${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}`;
  const [rows] = await pool.query(
    sql,
    ...(parameters.length > 0 ? [parameters] : [])
  );
  res.json(await attachTags(rows));
}

// must be registered before the "/quotes/:id" route so "random" isn't parsed as an id
async function getRandomQuote(req, res) {
  const [rows] = await pool.query("SELECT * FROM quotes ORDER BY RAND() LIMIT 1");
  if (rows.length === 0) {
    return res.status(404).json({ error: "No quotes found" });
  }
  const [quote] = await attachTags(rows);
  res.json(quote);
}

async function getQuoteById(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query("SELECT * FROM quotes WHERE id = ?", [id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }
  const [quote] = await attachTags(rows);
  res.json(quote);
}

async function addQuote(req, res) {
  const { quote, author } = req.body;
  const requestedSource = req.body.source;
  const parsedTags = parseTags(req.body.tags);
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
  if (parsedTags.error) {
    return res.status(400).json({ error: parsedTags.error });
  }

  const source = requestedSource || null;
  const tags = parsedTags.tags || [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO quotes (quote, author, source) VALUES (?, ?, ?)",
      [quote, author, source]
    );
    if (tags.length > 0) {
      await insertTags(connection, result.insertId, tags);
    }
    await connection.commit();
    res.status(201).json({ id: result.insertId, quote, author, source, tags });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateQuote(req, res) {
  const { id } = req.params;
  const { quote, author } = req.body;
  const requestedSource = req.body.source;
  const parsedTags = parseTags(req.body.tags);
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
  if (parsedTags.error) {
    return res.status(400).json({ error: parsedTags.error });
  }

  const source = requestedSource || null;
  const sourceProvided = Object.hasOwn(req.body, "source");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      "SELECT id FROM quotes WHERE id = ? FOR UPDATE",
      [id]
    );
    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Quote not found" });
    }

    if (sourceProvided) {
      await connection.query(
        "UPDATE quotes SET quote = ?, author = ?, source = ? WHERE id = ?",
        [quote, author, source, id]
      );
    } else {
      await connection.query(
        "UPDATE quotes SET quote = ?, author = ? WHERE id = ?",
        [quote, author, id]
      );
    }
    if (parsedTags.tags !== undefined) {
      await replaceTags(connection, id, parsedTags.tags);
    }
    await connection.commit();

    res.json({
      id: Number(id),
      quote,
      author,
      ...(sourceProvided ? { source } : {}),
      ...(parsedTags.tags !== undefined ? { tags: parsedTags.tags } : {}),
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
