// OpenClaw Gateway WebSocket Client
// Implements the gateway's JSON-RPC protocol with Ed25519 device auth

const STORAGE_KEY = 'openclaw-device-identity-v1'

interface DeviceIdentity {
  version: 1
  deviceId: string
  publicKey: string   // base64url
  privateKey: string  // base64url
  createdAtMs: number
}

interface PendingRequest {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'
type ChatState = 'idle' | 'sending' | 'streaming'

export interface ChatCallbacks {
  onChatStream?: (text: string) => void
  onChatComplete?: (messages: ChatMessage[], lastStreamText: string | null) => void
  onChatError?: (error: string) => void
}

export interface OpenClawClientOptions {
  gatewayUrl: string
  token?: string
  password?: string
  sessionKey?: string
  deviceIdentity?: { deviceId: string; publicKey: string; privateKey: string }
  onConnectionChange?: (state: ConnectionState) => void
  onChatStream?: (text: string) => void
  onChatComplete?: (messages: ChatMessage[], lastStreamText: string | null) => void
  onChatError?: (error: string) => void
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

function toBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

function uuid(): string {
  return crypto.randomUUID()
}

async function getOrCreateDevice(): Promise<DeviceIdentity> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.version === 1 && parsed.deviceId && parsed.publicKey && parsed.privateKey) {
        return parsed
      }
    }
  } catch { /* ignore */ }

  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])
  const pubKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const privKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

  const publicKey = toBase64url(pubKeyRaw)
  const privateKey = privKeyJwk.d!  // Ed25519 private key scalar in base64url

  const hashBuffer = await crypto.subtle.digest('SHA-256', pubKeyRaw)
  const deviceId = toHex(hashBuffer)

  const identity: DeviceIdentity = { version: 1, deviceId, publicKey, privateKey, createdAtMs: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  return identity
}

async function importPrivateKey(b64url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', {
    crv: 'Ed25519', d: b64url, x: '', kty: 'OKP', key_ops: ['sign']
  }, 'Ed25519', false, ['sign'])
}

async function importPrivateKeyWithPublic(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', {
    crv: 'Ed25519', d: privB64url, x: pubB64url, kty: 'OKP', key_ops: ['sign']
  }, 'Ed25519', false, ['sign'])
}

async function sign(privateKeyB64url: string, publicKeyB64url: string, message: string): Promise<string> {
  const key = await importPrivateKeyWithPublic(privateKeyB64url, publicKeyB64url)
  const data = new TextEncoder().encode(message)
  const sig = await crypto.subtle.sign('Ed25519', key, data)
  return toBase64url(sig)
}

export class OpenClawClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private closed = false
  private connectNonce: string | null = null
  private connectSent = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private backoffMs = 800
  private device: DeviceIdentity | null = null
  private streamText = ''
  private currentRunId: string | null = null

  connectionState: ConnectionState = 'disconnected'
  chatState: ChatState = 'idle'
  sessionKey: string

  private opts: OpenClawClientOptions

  constructor(opts: OpenClawClientOptions) {
    this.opts = opts
    this.sessionKey = opts.sessionKey || 'dashboard'
  }

  /** Swap the active session key, reset stream state, and fetch history for the new session. */
  async switchSession(key: string): Promise<void> {
    this.sessionKey = key
    this.streamText = ''
    this.chatState = 'idle'
    this.currentRunId = null
    if (this.connectionState === 'connected') {
      await this.fetchHistory()
    }
  }

  /** Replace chat callbacks without recreating the client. Used when switching between card threads and global chat. */
  setCallbacks(cb: ChatCallbacks): void {
    this.opts.onChatStream = cb.onChatStream
    this.opts.onChatComplete = cb.onChatComplete
    this.opts.onChatError = cb.onChatError
  }

  async start(): Promise<void> {
    this.closed = false
    if (this.opts.deviceIdentity) {
      const d = this.opts.deviceIdentity
      this.device = { version: 1, deviceId: d.deviceId, publicKey: d.publicKey, privateKey: d.privateKey, createdAtMs: 0 }
    } else {
      this.device = await getOrCreateDevice()
    }
    this.connect()
  }

  stop(): void {
    this.closed = true
    this.ws?.close()
    this.ws = null
    this.setConnectionState('disconnected')
    this.flushPending(new Error('client stopped'))
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.opts.onConnectionChange?.(state)
  }

  private connect(): void {
    if (this.closed) return
    this.setConnectionState('connecting')

    this.ws = new WebSocket(this.opts.gatewayUrl)

    this.ws.addEventListener('open', () => {
      this.queueConnect()
    })

    this.ws.addEventListener('message', (ev) => {
      this.handleMessage(String(ev.data ?? ''))
    })

    this.ws.addEventListener('close', (ev) => {
      this.ws = null
      this.flushPending(new Error(`closed (${ev.code}): ${ev.reason}`))
      this.setConnectionState('disconnected')
      this.scheduleReconnect()
    })

    this.ws.addEventListener('error', () => {})
  }

  private scheduleReconnect(): void {
    if (this.closed) return
    const delay = this.backoffMs
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15000)
    setTimeout(() => this.connect(), delay)
  }

  private flushPending(error: Error): void {
    this.pending.forEach(p => p.reject(error))
    this.pending.clear()
  }

  private queueConnect(): void {
    this.connectNonce = null
    this.connectSent = false
    if (this.connectTimer !== null) clearTimeout(this.connectTimer)
    this.connectTimer = setTimeout(() => this.sendConnect(), 100)
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.device) return
    this.connectSent = true
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }

    const { deviceId, publicKey, privateKey } = this.device
    const role = 'operator'
    const scopes = ['operator.admin']
    const signedAtMs = Date.now()
    const token = this.opts.token ?? ''
    const nonce = this.connectNonce ?? undefined

    const messageParts = ['v2', deviceId, 'webchat', 'webchat', role, scopes.join(','), String(signedAtMs), token]
    if (nonce) messageParts.push(nonce)
    const messageStr = messageParts.join('|')

    const signature = await sign(privateKey, publicKey, messageStr)

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: 'webchat' as const, version: '1.0.0', platform: 'web', mode: 'webchat' as const, instanceId: deviceId },
      role,
      scopes,
      device: { id: deviceId, publicKey, signature, signedAt: signedAtMs, nonce },
      caps: [],
      auth: { token: this.opts.token, password: this.opts.password },
      userAgent: navigator.userAgent,
      locale: navigator.language,
    }

    try {
      await this.request('connect', params)
      this.backoffMs = 800
      this.setConnectionState('connected')
    } catch {
      this.ws?.close(4008, 'connect failed')
    }
  }

  private handleMessage(raw: string): void {
    let msg: { type: string; id?: string; event?: string; payload?: Record<string, unknown>; ok?: boolean; error?: { message?: string } }
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'event') {
      if (msg.event === 'connect.challenge') {
        const payload = msg.payload as { nonce?: string } | undefined
        const nonce = payload?.nonce
        if (typeof nonce === 'string') {
          this.connectNonce = nonce
          this.connectSent = false
          this.sendConnect()
        }
        return
      }

      if (msg.event === 'chat') {
        this.handleChatEvent(msg.payload)
      }
      return
    }

    if (msg.type === 'res') {
      const p = this.pending.get(msg.id!)
      if (!p) return
      this.pending.delete(msg.id!)
      if (msg.ok) {
        p.resolve(msg.payload)
      } else {
        p.reject(new Error(msg.error?.message ?? 'request failed'))
      }
    }
  }

  private handleChatEvent(payload: Record<string, unknown> | undefined): void {
    if (!payload) return
    const p = payload as { sessionKey?: string; state?: string; message?: { content?: Array<{ type: string; text?: string }> }; runId?: string; errorMessage?: string }

    if (p.sessionKey !== this.sessionKey) return

    if (p.state === 'delta' && p.message?.content) {
      const text = p.message.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')
      if (text && text.length >= this.streamText.length) {
        this.streamText = text
        this.chatState = 'streaming'
        this.opts.onChatStream?.(text)
      }
    } else if (p.state === 'final') {
      this.chatState = 'idle'
      this.currentRunId = null
      const lastStreamText = this.streamText || null
      this.streamText = ''
      this.fetchHistory(lastStreamText)
    } else if (p.state === 'error') {
      this.chatState = 'idle'
      this.currentRunId = null
      this.streamText = ''
      this.opts.onChatError?.(p.errorMessage ?? 'Chat error')
    } else if (p.state === 'aborted') {
      this.chatState = 'idle'
      this.currentRunId = null
      this.streamText = ''
    }
  }

  async fetchHistory(lastStreamText?: string | null): Promise<void> {
    try {
      const result = await this.request('chat.history', { sessionKey: this.sessionKey, limit: 100 }) as { messages?: Array<{ role: string; content: unknown; timestamp?: number }> }
      if (result?.messages) {
        const messages: ChatMessage[] = result.messages.map(m => {
          let text = ''
          if (typeof m.content === 'string') {
            text = m.content
          } else if (Array.isArray(m.content)) {
            text = m.content.filter((c: { type: string; text?: string }) => c.type === 'text').map((c: { type: string; text?: string }) => c.text ?? '').join('')
          }
          return { role: m.role as 'user' | 'assistant', content: text, timestamp: m.timestamp ?? Date.now() }
        })
        this.opts.onChatComplete?.(messages, lastStreamText ?? null)
      }
    } catch (e) {
      console.error('Failed to fetch history:', e)
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.ws || this.connectionState !== 'connected') {
      this.opts.onChatError?.('Not connected to gateway')
      return
    }

    this.chatState = 'sending'
    this.streamText = ''
    const idempotencyKey = uuid()
    this.currentRunId = idempotencyKey

    try {
      await this.request('chat.send', {
        sessionKey: this.sessionKey,
        message: text,
        deliver: false,
        idempotencyKey,
      })
    } catch (e) {
      this.chatState = 'idle'
      this.currentRunId = null
      this.opts.onChatError?.(e instanceof Error ? e.message : 'Failed to send message')
    }
  }

  /** Public RPC call — use for health, status, or any gateway method. */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.connectionState !== 'connected') throw new Error('Not connected')
    return this.request(method, params ?? {}) as Promise<T>
  }

  private request(method: string, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'))
    }
    const id = uuid()
    const frame = { type: 'req', id, method, params }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws!.send(JSON.stringify(frame))
    })
  }
}
