/**
 * Single API client.
 *
 * `frontend.md` requires one contract-aware client handling expired sessions,
 * validation errors, conflicts, timeouts and safe retries consistently. The
 * rules below are enforced here rather than left to each page, because they
 * are the rules most easily broken by someone implementing a page quickly.
 *
 *  1. Credentials travel in the session cookie, never a header read from
 *     storage. `credentials: 'include'` on every request; nothing is persisted
 *     client-side.
 *  2. Every state-changing request carries the CSRF header.
 *  3. `Idempotency-Key` is supplied by the caller and REUSED across retries of
 *     the same logical command. The client never generates a fresh key for a
 *     retry — that would convert one payment into two.
 *  4. Only reads are retried automatically. A mutation whose outcome is
 *     unknown is surfaced, never silently repeated.
 *  5. A 401 invokes the session-expired handler so protected views and caches
 *     clear, per the query-partitioning requirement.
 */

import { ApiError, NetworkError, TimeoutError } from './errors'

export interface ClientConfig {
  baseUrl: string
  /** Invoked on any 401 so the app can clear protected state. */
  onSessionExpired?: () => void
  /**
   * Returns the current CSRF token. Supplied by the app once the session
   * endpoint provides it; a missing token is better than a guessed one, so
   * this may return null and the server will reject the write.
   */
  getCsrfToken?: () => string | null
  /** Milliseconds before a request is abandoned. */
  timeoutMs?: number
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /**
   * ETag for `If-Match`. Required by the contract on every mutation of a
   * versioned record; omitting it means the server rejects the write rather
   * than risking a lost update.
   */
  ifMatch?: string
  /**
   * Idempotency key for a duplicate-prone command. Create it ONCE per logical
   * operation — see `beginCommand` — and pass the same value on every retry.
   */
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs?: number
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE'])

export class ApiClient {
  private readonly config: Required<Pick<ClientConfig, 'baseUrl' | 'timeoutMs'>> &
    ClientConfig
  private readonly fetchImpl: typeof fetch

  constructor(config: ClientConfig) {
    this.config = { timeoutMs: 15_000, ...config }
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const isMutation = MUTATING_METHODS.has(method)

    const headers = new Headers({ Accept: 'application/json' })

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (isMutation) {
      const csrf = this.config.getCsrfToken?.() ?? null
      if (csrf) headers.set('X-CSRF-Token', csrf)
    }

    if (options.ifMatch) headers.set('If-Match', options.ifMatch)
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)

    const url = this.buildUrl(path, options.query)
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs

    // Compose caller abort with our timeout so either can cancel.
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutController.signal])
      : timeoutController.signal

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        // The session cookie must accompany cross-origin dev requests.
        credentials: 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
      })
    } catch (cause) {
      // No reply. For a mutation the server may still have committed, so the
      // outcome is unknown and the caller must not simply try again.
      if (timeoutController.signal.aborted) {
        throw new TimeoutError(isMutation)
      }
      throw new NetworkError('Сетевая ошибка', isMutation, cause)
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 401) {
      this.config.onSessionExpired?.()
    }

    if (response.status === 204) {
      return undefined as T
    }

    const payload = await this.readBody(response)

    if (!response.ok) {
      throw new ApiError(
        response.status,
        (payload ?? {}) as Record<string, unknown>,
      )
    }

    return payload as T
  }

  /**
   * Reads a response body, tolerating a non-JSON error page.
   *
   * A proxy or gateway can return HTML on a 502. Parsing that as JSON would
   * throw inside error handling and mask the real status.
   */
  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined

    try {
      return JSON.parse(text)
    } catch {
      return { message: `Неожиданный ответ сервера (${response.status})` }
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = `${this.config.baseUrl}${path}`
    if (!query) return url

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }

    const serialized = params.toString()
    return serialized ? `${url}?${serialized}` : url
  }
}

/**
 * A command whose key survives retries.
 *
 * Call once when the user initiates a duplicate-prone operation — a
 * reservation request, a payment, a membership activation, an attendance
 * mark — then pass `key` on every attempt. The key must NOT be regenerated
 * when a response is lost: reusing it is precisely what lets the server
 * recognise the retry and return the original committed result.
 *
 *   const command = beginCommand()
 *   await client.request('/payments', {
 *     method: 'POST', body, idempotencyKey: command.key,
 *   })
 *   // on an unknown outcome, retry with command.key — never beginCommand() again
 */
export interface IdempotentCommand {
  readonly key: string
}

export function beginCommand(): IdempotentCommand {
  return { key: crypto.randomUUID() }
}

/** Default client. Vite's dev proxy forwards `/api` to the backend. */
export const api = new ApiClient({ baseUrl: '/api/v1' })
