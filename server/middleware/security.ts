import { defineEventHandler, getRequestURL, setHeader } from 'h3'

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/public/')) setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
})
