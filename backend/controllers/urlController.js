const Url = require("../models/Url");
const shortid = require("shortid");
const Analytics = require("../models/Analytics");
const redis = require("../config/redis");
const useragent = require("useragent");

exports.createShortUrl = async (req, res) => {
  try {
    const { longUrl, customAlias, topic } = req.body;
    const userId = req.user.id;

    if (!longUrl) {
      return res.status(400).json({ error: "longUrl is required" });
    }

    try {
      new URL(longUrl);
    } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }
    if (customAlias) {
      const existingAlias = await Url.findOne({ customAlias });
      if (existingAlias) {
        return res.status(400).json({ error: "Custom alias already taken" });
      }
    }

    let generatedCustomAlias = customAlias || shortid.generate();

    if (!customAlias) {
      let isUnique = false;
      while (!isUnique) {
        generatedCustomAlias = shortid.generate();
        const existingAlias = await Url.findOne({
          customAlias: generatedCustomAlias,
        });
        if (!existingAlias) {
          isUnique = true;
        }
      }
    }

    const newUrl = new Url({
      longUrl,
      shortUrl: generatedCustomAlias,
      customAlias: generatedCustomAlias,
      topic,
      userId,
    });

    await newUrl.save();

    await redis.del(`analytics:user:${userId}`);
    await redis.del(`analytics:topic:${topic}`);

    res.status(201).json({
      shortUrl: `${process.env.BASE_URL}/api/shorten/${generatedCustomAlias}`,
      createdAt: newUrl.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.redirectShortUrl = async (req, res) => {
  try {
    const { alias } = req.params;

    const cachedUrl = await redis.get(`shorturl:${alias}`);
    if (cachedUrl) {
      await logAnalytics(alias, req);
      res.setHeader("Location", cachedUrl);
      return res.status(302).end();
    }

    const urlEntry = await Url.findOne({
      $or: [{ shortUrl: alias }, { customAlias: alias }],
    });

    if (!urlEntry) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    await redis.setex(`shorturl:${alias}`, 86400, urlEntry.longUrl);

    await logAnalytics(alias, req);

    res.setHeader("Location", urlEntry.longUrl);
    return res.status(302).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const logAnalytics = async (alias, req) => {
  const agent = useragent.parse(req.headers["user-agent"]);
  const osType = agent.os.toString();
  const deviceType = agent.device.toString();
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  const newAnalytics = new Analytics({
    shortUrl: alias,
    ipAddress,
    userAgent: req.headers["user-agent"],
    osType,
    deviceType,
    timestamp: new Date(),
  });

  await newAnalytics.save();
};

exports.getUrlAnalytics = async (req, res) => {
  try {
    const { alias } = req.params;

    const cachedAnalytics = await redis.get(`analytics:url:${alias}`);
    if (cachedAnalytics) {
      return res.json(JSON.parse(cachedAnalytics));
    }

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

    const response = {
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
    };

    await redis.setex(`analytics:url:${alias}`, 600, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getTopicAnalytics = async (req, res) => {
  try {
    const { topic } = req.params;

    const cachedAnalytics = await redis.get(`analytics:topic:${topic}`);
    if (cachedAnalytics) {
      return res.json(JSON.parse(cachedAnalytics));
    }

    const urls = await Url.find({ topic });

    if (!urls.length) {
      return res.status(404).json({ error: "No URLs found for this topic" });
    }

    const shortUrls = urls.map((url) => url.shortUrl);
    const analytics = await Analytics.find({ shortUrl: { $in: shortUrls } });

    const totalClicks = analytics.length;
    const uniqueUsers = new Set(analytics.map((entry) => entry.ipAddress)).size;

    const response = {
      totalClicks,
      uniqueUsers,
      urls: urls.map((url) => ({
        shortUrl: `${process.env.BASE_URL}/api/shorten/${url.shortUrl}`,
        totalClicks: analytics.filter((a) => a.shortUrl === url.shortUrl)
          .length,
      })),
    };

    await redis.setex(
      `analytics:topic:${topic}`,
      600,
      JSON.stringify(response)
    );

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getOverallAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const urls = await Url.find({ userId });

    if (!urls.length) {
      return res.status(404).json({ error: "No URLs found for this user" });
    }

    const shortUrls = urls.map((url) => url.shortUrl);
    const analytics = await Analytics.find({
      shortUrl: { $in: shortUrls },
      timestamp: { $exists: true },
    });

    analytics.forEach((entry) => {
      if (!entry.timestamp) {
        entry.timestamp = new Date();
      }
    });

    const totalUrls = urls.length;
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
      totalUrls,
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
    res.status(500).json({ error: "Internal Server Error" });
  }
};
