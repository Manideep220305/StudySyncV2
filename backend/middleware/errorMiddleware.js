const logger = require('../utils/logger');

const createHttpError = (status, code, message, details = undefined) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const notFound = (req, res, next) => {
  next(createHttpError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const status = err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  const safeStatus = status >= 400 ? status : 500;
  const code = err.code || (safeStatus >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
  const message = err.message || 'Something went wrong';

  logger.error('request_failed', {
    method: req.method,
    path: req.originalUrl,
    status: safeStatus,
    code,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(safeStatus).json({
    success: false,
    error: {
      code,
      message,
      details: err.details,
    },
  });
};

module.exports = {
  createHttpError,
  notFound,
  errorHandler,
};
