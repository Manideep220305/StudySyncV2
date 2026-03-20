const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVEL_ORDER = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const shouldLog = (level) => {
  const active = LEVEL_ORDER[LOG_LEVEL] ?? LEVEL_ORDER.info;
  const incoming = LEVEL_ORDER[level] ?? LEVEL_ORDER.info;
  return incoming <= active;
};

const write = (level, message, meta = {}) => {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

module.exports = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};
