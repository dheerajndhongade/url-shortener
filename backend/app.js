require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
require("./config/passport");

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cors());
app.use(passport.initialize());

app.use("/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/urlRoutes"));

app.get("/", (req, res) => {
  res.json({
    message: "🚀 URL Shortener API is running!",
    signInUrl: process.env.GOOGLE_CALLBACK_URL,
    instructions: [
      "1. Open the Sign-In URL in your browser.",
      "2. Authenticate with Google.",
      "3. After login, you'll be redirected with a token in the URL.",
      "4. Copy the token and use it in Postman for authenticated requests.",
      "5. In Postman, go to Authorization -> Select 'Bearer Token' -> Paste the token.",
      "6. Now, you can test secured endpoints like URL shortening.",
    ],
  });
});

let server;

function startServer(port = process.env.PORT) {
  if (process.env.NODE_ENV !== "test") {
    mongoose
      .connect(process.env.MONGO_URI)
      .then(() => console.log("Connected to MongoDB"))
      .catch((err) => console.error("MongoDB Connection Error:", err));
  }

  server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  return server;
}

function closeServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        mongoose.connection
          .close()
          .then(() => resolve())
          .catch(() => resolve());
      });
    } else {
      resolve();
    }
  });
}

app.startServer = startServer;
app.closeServer = closeServer;

if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = app;
