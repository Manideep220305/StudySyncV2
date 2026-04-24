const DEFAULT_FASTAPI_URL = 'http://localhost:8000';
const HEALTH_CHECK_INTERVAL_MS = 30_000;

const getAiBaseUrl = () => (process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL).replace(/\/+$/, '');

const createStatus = (overrides = {}) => ({
  available: false,
  status: 'unknown',
  service: 'fastapi-rag',
  url: getAiBaseUrl(),
  message: 'AI service has not been checked yet',
  checkedAt: null,
  responseTimeMs: null,
  upstreamStatus: null,
  details: null,
  ...overrides,
});

let cachedStatus = createStatus();

const getAiServiceStatus = () => ({ ...cachedStatus });

const resetAiServiceStatus = () => {
  cachedStatus = createStatus();
  return getAiServiceStatus();
};

const refreshAiServiceStatus = async ({ timeoutMs = 5000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${getAiBaseUrl()}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    const responseTimeMs = Date.now() - startedAt;
    const available = response.ok;
    const status = available ? 'online' : 'degraded';
    const message = available
      ? 'AI service is reachable'
      : payload?.detail || `AI service health check failed with status ${response.status}`;

    cachedStatus = createStatus({
      available,
      status,
      message,
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      upstreamStatus: response.status,
      details: payload,
    });

    return getAiServiceStatus();
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    cachedStatus = createStatus({
      available: false,
      status: 'offline',
      message: isTimeout ? 'AI service health check timed out' : error?.message || 'AI service is unreachable',
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      details: {
        error: error?.message || 'unknown_error',
      },
    });

    return getAiServiceStatus();
  } finally {
    clearTimeout(timeout);
  }
};

const getAiHealthCheckIntervalMs = () => HEALTH_CHECK_INTERVAL_MS;

module.exports = {
  getAiServiceStatus,
  refreshAiServiceStatus,
  resetAiServiceStatus,
  getAiHealthCheckIntervalMs,
};
