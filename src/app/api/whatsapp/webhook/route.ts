import { NextResponse } from 'next/server'
import { runWhatsAppCommand } from '@/lib/whatsapp/commands'
import { getWhatsAppWebhookEnv, hasWhatsAppWebhookEnv, normalizePhoneFromWebhook } from '@/lib/whatsapp/env'
import { hasSupabaseServiceEnv } from '@/lib/supabase/service'

interface WhatsAppMessage {
  from?: string
  type?: string
  text?: { body?: string }
}

function readVerifyParams(url: string) {
  const parsed = new URL(url)
  const mode = parsed.searchParams.get('hub.mode') || ''
  const token = parsed.searchParams.get('hub.verify_token') || ''
  const challenge = parsed.searchParams.get('hub.challenge') || ''
  return { mode, token, challenge }
}

async function sendWhatsAppReply(to: string, body: string) {
  const env = getWhatsAppWebhookEnv()
  const endpoint = `https://graph.facebook.com/v22.0/${env.phoneNumberId}/messages`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096) },
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.error('WhatsApp reply failed:', details)
  }
}

function isAllowedSender(from: string): boolean {
  const env = getWhatsAppWebhookEnv()
  const normalized = normalizePhoneFromWebhook(from)
  return env.allowedNumbers.includes(normalized)
}

function extractMessages(payload: any): WhatsAppMessage[] {
  const entries = Array.isArray(payload?.entry) ? payload.entry : []
  const messages: WhatsAppMessage[] = []
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const currentMessages = Array.isArray(change?.value?.messages) ? change.value.messages : []
      for (const msg of currentMessages) messages.push(msg as WhatsAppMessage)
    }
  }
  return messages
}

export async function GET(request: Request) {
  if (!hasWhatsAppWebhookEnv()) {
    return NextResponse.json({ error: 'WhatsApp env nao configurada.' }, { status: 500 })
  }

  const env = getWhatsAppWebhookEnv()
  const { mode, token, challenge } = readVerifyParams(request.url)
  if (mode === 'subscribe' && token === env.verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(request: Request) {
  if (!hasWhatsAppWebhookEnv()) {
    return NextResponse.json({ error: 'WhatsApp env nao configurada.' }, { status: 500 })
  }
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json({ error: 'Supabase service env nao configurada.' }, { status: 500 })
  }

  const env = getWhatsAppWebhookEnv()
  const payload = await request.json().catch(() => null)
  const messages = extractMessages(payload)

  for (const message of messages) {
    if (message.type !== 'text') continue
    const from = message.from || ''
    const text = message.text?.body || ''
    if (!from || !text) continue

    if (!isAllowedSender(from)) {
      await sendWhatsAppReply(from, 'Numero nao autorizado para comandos.')
      continue
    }

    const result = await runWhatsAppCommand({
      from,
      text,
      secret: env.commandSecret,
    })

    await sendWhatsAppReply(from, result.reply)
  }

  return NextResponse.json({ ok: true })
}
