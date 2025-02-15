const express = require("express");
const { createShortUrl } = require("../controllers/urlController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: "Too many requests, please try again later." },
});

router.post("/shorten", authMiddleware, limiter, createShortUrl);

module.exports = router;
