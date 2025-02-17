require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
require("./config/passport");

const app = express();

const swaggerDocument = YAML.load(path.join(__dirname, "urlshortenerdoc.yaml"));

app.set("trust proxy", 1);

app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);

app.options("*", cors());

app.use(passport.initialize());

app.use("/swagger-doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/urlRoutes"));

app.get("/", (req, res) => {
  res.send(`
    <h1>URL Shortener API is running!</h1>
    <p>Sign in here: <a href="${process.env.GOOGLE_CALLBACK_URL}">${process.env.GOOGLE_CALLBACK_URL}</a></p>
  `);
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
