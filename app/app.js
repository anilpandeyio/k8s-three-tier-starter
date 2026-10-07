const path = require("path");
const express = require("express");
const axios = require("axios");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Get the API URL from the environment variable or default to localhost for development
const API_URL = process.env.API_URL || "http://localhost:5001";

app.get("/", async (req, res) => {
  // GET request to fetch quotes from the API
  try {
    const response = await axios.get(`${API_URL}/api/quotes`);
    res.render("index", { quotes: response.data });
  } catch (err) {
    // Handle the case where the API is down or returning an error
    console.error(`Error: Unable to fetch quotes. ${err.message}`);
    res.render("index", { quotes: [] });
  }
});

app.post("/", async (req, res) => {
  // Post the quote to the API
  const { quote, author } = req.body;
  try {
    const response = await axios.post(`${API_URL}/api/quotes`, {
      quote,
      author,
    });
    if (response.status === 201) {
      return res.redirect("/");
    }
    res.status(500).send("Error: Unable to save quote");
  } catch (err) {
    res.status(500).send("Error: Unable to save quote");
  }
});

// Use the PORT environment variable set by Beanstalk, defaulting to 5002 for local development
const port = process.env.PORT || 5002;
app.listen(port, "0.0.0.0", () => {
  console.log(`App listening on port ${port}`);
});
