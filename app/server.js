const app = require("./src/app");

// Use the PORT environment variable set by Beanstalk, defaulting to 5002 for local development
const port = process.env.PORT || 5002;
app.listen(port, "0.0.0.0", () => {
  console.log(`App listening on port ${port}`);
});
