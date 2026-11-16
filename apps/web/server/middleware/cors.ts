/**
 * The mobile app calls the API from its own origin with a bearer token, so /api answers CORS for
 * the app's origins only. No cookies are involved (credentials stay off).
 */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return
  const origin = getRequestHeader(event, 'origin')
  if (!isAppOrigin(origin)) return
  setResponseHeaders(event, {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-expose-headers': 'set-auth-token',
    'access-control-max-age': 86400,
    vary: 'Origin',
  })
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
