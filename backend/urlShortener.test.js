const request = require("supertest");
const app = require("./app");
const Url = require("./models/Url");
const Analytics = require("./models/Analytics");
const redis = require("./config/redis");
const jwt = require("jsonwebtoken");

jest.mock("./models/Url");
jest.mock("./models/Analytics");
jest.mock("./config/redis");

describe("URL Shortener API Tests", () => {
  let token;
  let server;

  beforeAll(async () => {
    // Start server
    server = app.startServer();

    // Create test token
    token = jwt.sign(
      { id: "testuser123" },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" }
    );
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    Url.prototype.save.mockImplementation(function () {
      return Promise.resolve(this);
    });

    // Mock redis methods
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue(true);
    redis.del.mockResolvedValue(true);
  });

  afterAll(async () => {
    await app.closeServer();
  });

  describe("POST /api/shorten", () => {
    // Example of a protected route test
    it("should create a short URL", async () => {
      Url.findOne.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/shorten")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/json")
        .send({ longUrl: "https://example.com", topic: "tech" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("shortUrl");
    });

    it("should return 400 if longUrl is missing", async () => {
      const res = await request(app)
        .post("/api/shorten")
        .set("Authorization", `Bearer ${token}`)
        .send({ topic: "tech" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("longUrl is required");
    });

    it("should return 400 if longUrl is invalid", async () => {
      const res = await request(app)
        .post("/api/shorten")
        .set("Authorization", `Bearer ${token}`)
        .send({ longUrl: "invalid-url", topic: "tech" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid URL format");
    });

    it("should return 500 if database error occurs", async () => {
      Url.prototype.save = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .post("/api/shorten")
        .set("Authorization", `Bearer ${token}`)
        .send({ longUrl: "https://example.com", topic: "tech" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
    });
  });

  describe("GET /api/analytics/:alias", () => {
    it("should return analytics data", async () => {
      Url.findOne.mockResolvedValueOnce({ shortUrl: "abc123" });
      Analytics.find.mockResolvedValueOnce([
        { ipAddress: "192.168.1.1", timestamp: new Date() },
      ]);

      const res = await request(app)
        .get("/api/analytics/abc123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalClicks");
    });

    it("should return 404 if alias not found", async () => {
      Url.findOne.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/analytics/notfound")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Short URL not found");
    });
  });

  describe("GET /api/analytics/topic/:topic", () => {
    it("should return analytics by topic", async () => {
      Url.find.mockResolvedValueOnce([
        { shortUrl: "abc123" },
        { shortUrl: "xyz789" },
      ]);
      Analytics.find.mockResolvedValueOnce([
        { shortUrl: "abc123", ipAddress: "192.168.1.1", timestamp: new Date() },
      ]);

      const res = await request(app)
        .get("/api/analytics/topic/tech")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalClicks");
    });

    it("should return 404 if no URLs found for the topic", async () => {
      Url.find.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/analytics/topic/unknown")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("No URLs found for this topic");
    });
  });

  describe("GET /api/analytics/overall", () => {
    it("should return overall analytics", async () => {
      // Mock the timestamp
      const mockTimestamp = new Date();

      Url.find.mockResolvedValueOnce([{ shortUrl: "abc123" }]);
      Analytics.find.mockResolvedValueOnce([
        {
          ipAddress: "192.168.1.1",
          timestamp: mockTimestamp,
          osType: "Windows",
          deviceType: "Desktop",
        },
      ]);

      const res = await request(app)
        .get("/api/analytics/overall")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalClicks");
    });

    it("should handle invalid token format", async () => {
      const res = await request(app)
        .get("/api/analytics/overall")
        .set("Authorization", "InvalidTokenFormat");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token format");
    });

    it("should handle expired token", async () => {
      // Create an actually expired token
      const expiredToken = jwt.sign(
        { id: "testuser123" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "0s" } // Token that expires immediately
      );

      const res = await request(app)
        .get("/api/analytics/overall")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Token expired");
    });

    it("should handle database connection error", async () => {
      Url.find.mockRejectedValueOnce(new Error("Database connection failed"));

      const res = await request(app)
        .get("/api/analytics/overall")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
    });

    it("should handle analytics query error", async () => {
      Url.find.mockResolvedValueOnce([{ shortUrl: "abc123" }]);
      Analytics.find.mockRejectedValueOnce(new Error("Analytics query failed"));

      const res = await request(app)
        .get("/api/analytics/overall")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
    });
  });
});
