export interface WhatsAppWebhookEnv {
  verifyToken: string
  apiToken: string
  phoneNumberId: string
  commandSecret: string
  allowedNumbers: string[]
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, '')
}

export function getWhatsAppWebhookEnv(): WhatsAppWebhookEnv {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || ''
  const apiToken = process.env.WHATSAPP_API_TOKEN || ''
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  const commandSecret = process.env.WHATSAPP_COMMAND_SECRET || ''
  const allowedRaw = process.env.WHATSAPP_ALLOWED_NUMBERS || ''
  const allowedNumbers = allowedRaw
    .split(',')
    .map((item) => normalizePhone(item.trim()))
    .filter(Boolean)

  return {
    verifyToken,
    apiToken,
    phoneNumberId,
    commandSecret,
    allowedNumbers,
  }
}

export function hasWhatsAppWebhookEnv() {
  const env = getWhatsAppWebhookEnv()
  return Boolean(
    env.verifyToken
    && env.apiToken
    && env.phoneNumberId
    && env.commandSecret
    && env.allowedNumbers.length > 0,
  )
}

export function normalizePhoneFromWebhook(value: string): string {
  return normalizePhone(value || '')
}
