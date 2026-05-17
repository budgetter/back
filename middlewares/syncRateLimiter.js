const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for the sync endpoint.
 * Limits each user to 5 sync requests per 15-minute window.
 * Returns HTTP 429 with Retry-After header when exceeded.
 */
const syncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sync requests. Please try again later." },
});

module.exports = { syncRateLimiter };
