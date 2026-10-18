const SOURCE_COLUMN_LOCK = "quotes-schema-migrations";

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

module.exports = { ensureSourceColumn };
