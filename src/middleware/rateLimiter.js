// src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

/**
 * Strict rate limit for authentication endpoints
 * Prevents brute force password attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window per IP
  message: {
    message: "Too many login attempts from this IP. Please try again after 15 minutes.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests (only count failed attempts)
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts from this IP. Please try again after 15 minutes.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60) + " minutes"
    });
  }
});

/**
 * Moderate rate limit for general API endpoints
 * Prevents API abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window per IP
  message: {
    message: "Too many requests from this IP. Please slow down."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limit for sensitive operations
 * Password reset and other critical actions
 */
export const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 requests per hour per IP
  message: {
    message: "Too many password reset attempts from this IP. Please try again after 1 hour.",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many password reset attempts from this IP. Please try again after 1 hour.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60) + " minutes"
    });
  }
});