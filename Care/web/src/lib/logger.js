const levels = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function log(level, dataOrMsg, msg) {
  if ((levels[level] ?? 3) > currentLevel) return;
  const ts     = new Date().toISOString();
  const method = level === 'fatal' || level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  if (typeof dataOrMsg === 'string') {
    console[method](`[${ts}] ${level.toUpperCase()} ${dataOrMsg}`);
  } else {
    console[method](`[${ts}] ${level.toUpperCase()} ${msg || ''}`, JSON.stringify(dataOrMsg));
  }
}

const logger = {
  fatal: (d, m) => log('fatal', d, m),
  error: (d, m) => log('error', d, m),
  warn:  (d, m) => log('warn',  d, m),
  info:  (d, m) => log('info',  d, m),
  debug: (d, m) => log('debug', d, m),
};

export default logger;
