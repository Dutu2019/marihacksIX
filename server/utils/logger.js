export function log(...args) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${timestamp}]`, ...args);
}

export function logError(...args) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  console.error(`[${timestamp}]`, ...args);
}
