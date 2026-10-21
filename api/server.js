const app = require("./src/app");
const pool = require("./src/config/db");
const logger = require("./src/logger");
const { ensureSourceColumn, ensureQuoteTagsTable } = require("./src/migrations");

// Use the PORT environment variable provided by Beanstalk, defaulting to 5001 for local development
const port = process.env.PORT || 5001;

async function start() {
  const sourceColumnAdded = await ensureSourceColumn(pool);
  if (sourceColumnAdded) {
    logger.info("Applied database migration: added quotes.source");
  }
  const quoteTagsTableCreated = await ensureQuoteTagsTable(pool);
  if (quoteTagsTableCreated) {
    logger.info("Applied database migration: created quote_tags");
  }
  app.listen(port, "0.0.0.0", () => {
    logger.info(`API listening on port ${port}`);
  });
}

start().catch((err) => {
  logger.error(`API startup failed. ${err.message}`);
  pool
    .end()
    .catch((shutdownError) => {
      logger.error(
        `Unable to close database pool after startup failure. ${shutdownError.message}`
      );
    })
    .finally(() => {
      process.exitCode = 1;
    });
});
