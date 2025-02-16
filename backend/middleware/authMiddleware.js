const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "test-secret"
      );
      req.user = decoded;
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Invalid token" });
      }
      return res.status(401).json({ error: "Token validation failed" });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
