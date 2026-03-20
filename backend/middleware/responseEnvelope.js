const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const responseEnvelope = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (res.locals.skipEnvelope) {
      return originalJson(payload);
    }

    if (
      isObject(payload) &&
      Object.prototype.hasOwnProperty.call(payload, 'success') &&
      (Object.prototype.hasOwnProperty.call(payload, 'data') ||
        Object.prototype.hasOwnProperty.call(payload, 'error'))
    ) {
      return originalJson(payload);
    }

    if (res.statusCode >= 400) {
      const message = isObject(payload) && payload.message ? payload.message : 'Request failed';
      const code = isObject(payload) && payload.code ? payload.code : 'REQUEST_FAILED';
      const details = isObject(payload) ? payload.details : undefined;

      return originalJson({
        success: false,
        error: { code, message, details },
      });
    }

    return originalJson({
      success: true,
      data: payload,
    });
  };

  next();
};

module.exports = { responseEnvelope };
