const Url = require("../models/Url");
const shortid = require("shortid");
const Analytics = require("../models/Analytics");

exports.createShortUrl = async (req, res) => {
  try {
    const { longUrl, customAlias, topic } = req.body;
    const userId = req.user.id;

    if (!longUrl) {
      return res.status(400).json({ error: "longUrl is required" });
    }

    let shortUrl;

    if (customAlias) {
      const existingAlias = await Url.findOne({ customAlias });
      if (existingAlias) {
        return res.status(400).json({ error: "Custom alias already taken" });
      }
      shortUrl = customAlias;
    } else {
      shortUrl = shortid.generate();
    }

    const newUrl = new Url({
      longUrl,
      shortUrl,
      customAlias: customAlias || null,
      topic,
      userId,
    });

    await newUrl.save();

    res.status(201).json({
      shortUrl: `${process.env.BASE_URL}/api/shorten/${shortUrl}`,
      createdAt: newUrl.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.redirectShortUrl = async (req, res) => {
  try {
    const { alias } = req.params;

    const urlEntry = await Url.findOne({
      $or: [{ shortUrl: alias }, { customAlias: alias }],
    });

    if (!urlEntry) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    const userAgent = req.headers["user-agent"];
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    let locationData = {};
    try {
      const geoResponse = await fetch(`http://ip-api.com/json/${ip}`);
      locationData = await geoResponse.json();
    } catch (error) {
      console.error("Error fetching geolocation:", error);
    }

    const analyticsData = new Analytics({
      shortUrl: alias,
      ipAddress: ip,
      userAgent,
      osType: userAgent.includes("Windows")
        ? "Windows"
        : userAgent.includes("Mac")
        ? "macOS"
        : userAgent.includes("Linux")
        ? "Linux"
        : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone")
        ? "iOS"
        : "Unknown",
      deviceType: userAgent.includes("Mobi") ? "Mobile" : "Desktop",
      country: locationData.country || "Unknown",
      city: locationData.city || "Unknown",
      timestamp: new Date(),
    });

    await analyticsData.save();

    res.redirect(urlEntry.longUrl);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
