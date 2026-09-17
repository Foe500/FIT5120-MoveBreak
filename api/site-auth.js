import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const COOKIE_NAME = 'movebreak_site_access'
const MAX_AGE = 60 * 60 * 12

function tokenFor(password) {
  return crypto.createHmac('sha256', password).update('movebreak-site-access-v1').digest('hex')
}

function matches(left, right) {
  const a = Buffer.from(left || '')
  const b = Buffer.from(right || '')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function readCookie(header = '') {
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))
  return item?.slice(COOKIE_NAME.length + 1) || ''
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const password = process.env.SITE_PASSWORD
  if (!password) return response.status(503).json({ error: 'Site access is not configured.' })

  const token = tokenFor(password)
  if (request.method === 'GET') {
    const authenticated = matches(readCookie(request.headers.cookie), token)
    return response.status(authenticated ? 200 : 401).json({ authenticated })
  }
  if (request.method === 'POST') {
    if (!matches(request.body?.password, password)) {
      return response.status(401).json({ error: 'Incorrect password.' })
    }
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`)
    return response.status(200).json({ authenticated: true })
  }
  response.setHeader('Allow', 'GET, POST')
  return response.status(405).json({ error: 'Method not allowed.' })
}
