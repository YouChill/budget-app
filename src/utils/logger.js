// Thin logger wrapper. Allows future forwarding to telemetry and silences
// debug/info noise in production builds while keeping errors/warnings visible.

const isDev = import.meta.env?.DEV ?? false;

function prefix(scope) {
  return scope ? [`[${scope}]`] : [];
}

export const logger = {
  error(scope, ...args) {
    console.error(...prefix(scope), ...args);
  },
  warn(scope, ...args) {
    console.warn(...prefix(scope), ...args);
  },
  info(scope, ...args) {
    if (isDev) console.info(...prefix(scope), ...args);
  },
  debug(scope, ...args) {
    if (isDev) console.debug(...prefix(scope), ...args);
  },
};
