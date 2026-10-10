import crypto from "node:crypto"

/** Imported teams get addresses like hrd-import-2026-row-12@example.local until a real one is added. */
export function isPlaceholderEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  return (
    !domain ||
    domain.endsWith(".local") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".test") ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net"
  )
}

function signingSecret() {
  const secret = process.env.EXPORT_SIGNING_SECRET ?? process.env.CRON_SECRET
  if (!secret) throw new Error("Set EXPORT_SIGNING_SECRET (or CRON_SECRET) to sign unsubscribe links.")
  return secret
}

/** Signed per owner and season, since an unsubscribe only covers one season. */
export function unsubscribeToken(ownerId: string, seasonId: string) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`unsubscribe:${ownerId}:${seasonId}`)
    .digest("hex")
    .slice(0, 32)
}

export function verifyUnsubscribeToken(ownerId: string, seasonId: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(ownerId, seasonId))
  const given = Buffer.from(token)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export function siteUrl() {
  const explicit = process.env.PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : "http://localhost:3000"
}
