const app = require("./src/app");
const logger = require("./src/logger");

// Use the PORT environment variable set by Beanstalk, defaulting to 5002 for local development
const port = process.env.PORT || 5002;
app.listen(port, "0.0.0.0", () => {
  logger.info(`App listening on port ${port}`);
});
