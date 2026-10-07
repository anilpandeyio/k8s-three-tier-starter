const express = require("express");
const quotesRoutes = require("./routes/quotes.routes");
const healthRoutes = require("./routes/health.routes");

const app = express();
app.use(express.json());

app.use("/api", quotesRoutes);
app.use("/", healthRoutes);

module.exports = app;
