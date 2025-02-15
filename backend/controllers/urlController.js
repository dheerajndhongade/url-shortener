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

exports.getUrlAnalytics = async (req, res) => {
  try {
    const { alias } = req.params;

    const urlEntry = await Url.findOne({
      $or: [{ shortUrl: alias }, { customAlias: alias }],
    });

    if (!urlEntry) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    const analytics = await Analytics.find({ shortUrl: alias });

    const totalClicks = analytics.length;
    const uniqueUsers = new Set(analytics.map((entry) => entry.ipAddress)).size;

    const last7Days = {};
    const osStats = {};
    const deviceStats = {};

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const formattedDate = date.toISOString().split("T")[0];
      last7Days[formattedDate] = 0;
    }

    analytics.forEach((entry) => {
      const date = entry.timestamp.toISOString().split("T")[0];
      if (last7Days[date] !== undefined) {
        last7Days[date]++;
      }

      if (!osStats[entry.osType]) {
        osStats[entry.osType] = new Set();
      }
      osStats[entry.osType].add(entry.ipAddress);

      if (!deviceStats[entry.deviceType]) {
        deviceStats[entry.deviceType] = new Set();
      }
      deviceStats[entry.deviceType].add(entry.ipAddress);
    });

    res.json({
      totalClicks,
      uniqueUsers,
      clicksByDate: Object.entries(last7Days).map(([date, count]) => ({
        date,
        clickCount: count,
      })),
      osType: Object.entries(osStats).map(([os, users]) => ({
        osName: os,
        uniqueClicks: users.size,
        uniqueUsers: users.size,
      })),
      deviceType: Object.entries(deviceStats).map(([device, users]) => ({
        deviceName: device,
        uniqueClicks: users.size,
        uniqueUsers: users.size,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getTopicAnalytics = async (req, res) => {
  try {
    const { topic } = req.params;

    const urls = await Url.find({ topic });

    if (!urls.length) {
      return res.status(404).json({ error: "No URLs found for this topic" });
    }

    const shortUrls = urls.map((url) => url.shortUrl);

    const analytics = await Analytics.find({ shortUrl: { $in: shortUrls } });

    const totalClicks = analytics.length;
    const uniqueUsers = new Set(analytics.map((entry) => entry.ipAddress)).size;

    const last7Days = {};
    const urlStats = {};

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const formattedDate = date.toISOString().split("T")[0];
      last7Days[formattedDate] = 0;
    }

    analytics.forEach((entry) => {
      const date = entry.timestamp.toISOString().split("T")[0];
      if (last7Days[date] !== undefined) {
        last7Days[date]++;
      }

      if (!urlStats[entry.shortUrl]) {
        urlStats[entry.shortUrl] = new Set();
      }
      urlStats[entry.shortUrl].add(entry.ipAddress);
    });

    res.json({
      totalClicks,
      uniqueUsers,
      clicksByDate: Object.entries(last7Days).map(([date, count]) => ({
        date,
        clickCount: count,
      })),
      urls: urls.map((url) => ({
        shortUrl: `${process.env.BASE_URL}/api/shorten/${url.shortUrl}`,
        totalClicks: analytics.filter((a) => a.shortUrl === url.shortUrl)
          .length,
        uniqueUsers: urlStats[url.shortUrl] ? urlStats[url.shortUrl].size : 0,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
