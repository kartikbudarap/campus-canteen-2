const crypto = require("crypto");
const RateLimit = require("../models/rate-limit.model");

const rateLimit = (limit, windowMs) => async (req, res, next) => {
  try {
    const currentWindow = Math.floor(Date.now() / windowMs);
    const expiresAt = new Date((currentWindow + 1) * windowMs);
    const key = `${req.ip}:${limit}:${windowMs}:${currentWindow}`;
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");

    let attempt;
    try {
      attempt = await RateLimit.findOneAndUpdate(
        { _id: keyHash },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      // Another request created this window at the same time. Count this one too.
      attempt = await RateLimit.findOneAndUpdate(
        { _id: keyHash },
        { $inc: { count: 1 } },
        { new: true }
      );
    }

    if (attempt.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = rateLimit;
