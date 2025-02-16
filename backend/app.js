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
  res.send(
    `URL Shortener API is running!\n
Authenticate using Google:\n
👉 ${process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"}\n
\n
How to Authenticate and Use the API in Postman:\n
1️⃣ Click on the Sign in with Google link above.\n
2️⃣ Authenticate with your Google account.\n
3️⃣ After login, you will be redirected with a token in the URL.\n
4️⃣ Copy the token from the redirected URL.\n
5️⃣ Open Postman and go to the request settings.\n
6️⃣ Under the Authorization tab, select Bearer Token.\n
7️⃣ Paste the copied token into the token field.\n
8️⃣ Now, you can test secured endpoints like URL shortening.\n
\n
  );
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
