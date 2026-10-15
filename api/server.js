const app = require("./src/app");
const logger = require("./src/logger");

// Use the PORT environment variable provided by Beanstalk, defaulting to 5001 for local development
const port = process.env.PORT || 5001;
app.listen(port, "0.0.0.0", () => {
  logger.info(`API listening on port ${port}`);
});
