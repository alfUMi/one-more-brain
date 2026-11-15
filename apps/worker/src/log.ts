/** Minimal structured logging: one JSON line per event. Never log item content (privacy). */
function write(level: string, msg: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...data }))
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => write('info', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write('error', msg, data),
}
