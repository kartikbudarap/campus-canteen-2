const rateLimit = (limit, windowMs) => {
  const attempts = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.expiresAt <= now) attempts.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowMs };
      attempts.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.expiresAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }
    next();
  };
};

module.exports = rateLimit;
