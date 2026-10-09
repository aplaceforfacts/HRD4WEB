/**
 * Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email).
 * Configure with RESEND_API_KEY and EXPORT_FROM_EMAIL ("League <standings@yourdomain.com>").
 */

export type OutgoingEmail = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string | null
  attachments?: Array<{ filename: string; content: Buffer }>
  /** Resend drops a repeat send with the same key, so a retried delivery can't double-send. */
  idempotencyKey: string
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EXPORT_FROM_EMAIL)
}

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EXPORT_FROM_EMAIL
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and EXPORT_FROM_EMAIL must both be set to send email.")

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.attachments
        ? {
            attachments: email.attachments.map((file) => ({
              filename: file.filename,
              content: file.content.toString("base64"),
            })),
          }
        : {}),
    }),
  })

  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }

  if (!response.ok || !body.id) {
    throw new Error(`Resend ${response.status}: ${body.message ?? body.name ?? "send failed"}`)
  }

  return { id: body.id }
}
