/**
 * Error code to user-facing message mapping.
 * Internal error details are never exposed to the client.
 */
const ERROR_MAP = {
  GMAIL_API_ERROR: "Unable to connect to email provider",
  DECRYPTION_FAILURE: "Integration credentials need to be refreshed",
  PARSE_ERROR: "Unable to process email content",
  DB_ERROR: "An error occurred processing your request",
};

const DEFAULT_MESSAGE = "An error occurred processing your request";

/**
 * Express error-handling middleware for integration routes.
 * - Logs detailed error info server-side (message, stack, path, userId)
 * - Maps internal error codes to generic user-facing messages
 * - Never exposes stack traces, internal paths, or DB error details
 *
 * Requirements: 6.1, 6.2, 6.3
 */
function errorSanitizer(err, req, res, next) {
  console.error("Integration Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    userId: req.user?.id,
  });

  const statusCode = err.statusCode || 500;
  const userMessage = ERROR_MAP[err.code] || DEFAULT_MESSAGE;

  res.status(statusCode).json({ message: userMessage });
}

module.exports = { errorSanitizer, ERROR_MAP };
