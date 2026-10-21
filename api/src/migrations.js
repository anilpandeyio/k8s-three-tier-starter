const SOURCE_COLUMN_LOCK = "quotes-schema-migrations";
const QUOTE_TAGS_TABLE_LOCK = "quote-tags-schema-migrations";

async function ensureSourceColumn(pool) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let sourceColumnAdded = false;

  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
      SOURCE_COLUMN_LOCK,
      30,
    ]);
    if (lockRows[0]?.acquired !== 1) {
      throw new Error("Unable to acquire database schema migration lock");
    }
    lockAcquired = true;

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'quotes'
         AND COLUMN_NAME = 'source'`
    );
    if (columns.length === 0) {
      await connection.query(
        "ALTER TABLE quotes ADD COLUMN source varchar(255) DEFAULT NULL"
      );
      sourceColumnAdded = true;
    }
  } finally {
    try {
      if (lockAcquired) {
        await connection.query("SELECT RELEASE_LOCK(?)", [SOURCE_COLUMN_LOCK]);
      }
    } finally {
      connection.release();
    }
  }

  return sourceColumnAdded;
}

async function ensureQuoteTagsTable(pool) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let quoteTagsTableCreated = false;

  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
      QUOTE_TAGS_TABLE_LOCK,
      30,
    ]);
    if (lockRows[0]?.acquired !== 1) {
      throw new Error("Unable to acquire quote tags schema migration lock");
    }
    lockAcquired = true;

    const [tables] = await connection.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'quote_tags'`
    );
    if (tables.length === 0) {
      await connection.query(
        `CREATE TABLE quote_tags (
          quote_id int(11) NOT NULL,
          tag varchar(100) NOT NULL,
          PRIMARY KEY (quote_id, tag),
          KEY idx_quote_tags_tag (tag),
          CONSTRAINT fk_quote_tags_quote
            FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      quoteTagsTableCreated = true;
    }
  } finally {
    try {
      if (lockAcquired) {
        await connection.query("SELECT RELEASE_LOCK(?)", [QUOTE_TAGS_TABLE_LOCK]);
      }
    } finally {
      connection.release();
    }
  }

  return quoteTagsTableCreated;
}

module.exports = { ensureSourceColumn, ensureQuoteTagsTable };
