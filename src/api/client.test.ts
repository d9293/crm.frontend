/**
 * API client tests.
 *
 * Focused on the distinctions that cause real damage when conflated: a known
 * rejection versus an unknown outcome, and whether an idempotency key survives
 * a retry.
 */

import { describe, expect, it, vi } from 'vitest'
import { ApiClient, beginCommand } from './client'
import { ApiError, NetworkError, TimeoutError, isOutcomeUnknown } from './errors'
import { fixtureValidationError, fixtureVersionConflictError } from './fixtures'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientWith(fetchImpl: typeof fetch, overrides = {}) {
  return new ApiClient({ baseUrl: '/api/v1', fetchImpl, ...overrides })
}

describe('error mapping', () => {
  it('maps a 422 body to a field-level ApiError', async () => {
    const client = clientWith(vi.fn().mockResolvedValue(jsonResponse(422, fixtureValidationError)))

    const error = await client.request('/employees', { method: 'POST', body: {} })
      .then(() => null)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('VALIDATION_FAILED')
    expect(apiError.isValidation).toBe(true)
    expect(apiError.fieldErrors.full_name).toEqual(['Укажите имя сотрудника.'])
    // A rejection is a KNOWN outcome: nothing was committed, so a retry is safe.
    expect(isOutcomeUnknown(apiError)).toBe(false)
  })

  it('exposes current_version on a 409 so the UI can show a conflict', async () => {
    const client = clientWith(
      vi.fn().mockResolvedValue(jsonResponse(409, fixtureVersionConflictError)),
    )

    const error = (await client
      .request('/employees/7', { method: 'PATCH', body: {}, ifMatch: '"3"' })
      .catch((caught: unknown) => caught)) as ApiError

    expect(error.isVersionConflict).toBe(true)
    expect(error.currentVersion).toBe(4)
  })

  it('invokes the session-expired handler on 401', async () => {
    const onSessionExpired = vi.fn()
    const client = clientWith(
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'NOT_AUTHENTICATED', message: 'x' })),
      { onSessionExpired },
    )

    await client.request('/me').catch(() => undefined)

    expect(onSessionExpired).toHaveBeenCalledOnce()
  })

  it('does not throw while parsing a non-JSON error page', async () => {
    // A gateway can return HTML on a 502. Parsing it as JSON must not throw
    // inside error handling and mask the real status.
    const client = clientWith(
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })),
    )

    const error = (await client.request('/me').catch((caught: unknown) => caught)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
  })
})

describe('unknown outcomes', () => {
  it('marks a failed mutation as unknown, since the server may have committed', async () => {
    const client = clientWith(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = (await client
      .request('/payments', { method: 'POST', body: {} })
      .catch((caught: unknown) => caught)) as NetworkError

    expect(error).toBeInstanceOf(NetworkError)
    expect(isOutcomeUnknown(error)).toBe(true)
  })

  it('marks a failed read as known-harmless', async () => {
    const client = clientWith(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = (await client.request('/me').catch((caught: unknown) => caught)) as NetworkError

    // Nothing was changed, so retrying a GET is free.
    expect(isOutcomeUnknown(error)).toBe(false)
  })

  it('treats a timed-out mutation as an unknown outcome', async () => {
    const client = clientWith(
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      ),
      { timeoutMs: 10 },
    )

    const error = (await client
      .request('/payments', { method: 'POST', body: {} })
      .catch((caught: unknown) => caught)) as TimeoutError

    expect(error).toBeInstanceOf(TimeoutError)
    expect(error.outcomeUnknown).toBe(true)
  })
})

describe('headers', () => {
  it('reuses one idempotency key across retries of the same command', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(201, { id: 1 }))
    const client = clientWith(fetchImpl)

    // Created ONCE for the logical operation, then reused. Generating a fresh
    // key on retry is what turns one payment into two.
    const command = beginCommand()

    await client
      .request('/payments', { method: 'POST', body: {}, idempotencyKey: command.key })
      .catch(() => undefined)
    await client.request('/payments', {
      method: 'POST',
      body: {},
      idempotencyKey: command.key,
    })

    const [firstCall, secondCall] = fetchImpl.mock.calls
    const firstKey = (firstCall[1].headers as Headers).get('Idempotency-Key')
    const secondKey = (secondCall[1].headers as Headers).get('Idempotency-Key')

    expect(firstKey).toBe(command.key)
    expect(secondKey).toBe(command.key)
  })

  it('sends CSRF and If-Match on mutations but not on reads', async () => {
    // `mockImplementation`, not `mockResolvedValue`: a Response body can be
    // read only once, so each call needs a fresh one.
    const fetchImpl = vi.fn().mockImplementation(() => jsonResponse(200, {}))
    const client = clientWith(fetchImpl, { getCsrfToken: () => 'token-abc' })

    await client.request('/employees/7', { method: 'PATCH', body: {}, ifMatch: '"3"' })
    await client.request('/me')

    const mutationHeaders = fetchImpl.mock.calls[0][1].headers as Headers
    const readHeaders = fetchImpl.mock.calls[1][1].headers as Headers

    expect(mutationHeaders.get('X-CSRF-Token')).toBe('token-abc')
    expect(mutationHeaders.get('If-Match')).toBe('"3"')
    expect(readHeaders.get('X-CSRF-Token')).toBeNull()
  })

  it('always sends the session cookie and never an auth header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    const client = clientWith(fetchImpl)

    await client.request('/me')

    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
    // The session is an HttpOnly cookie; there is no token to read or send.
    expect((init.headers as Headers).get('Authorization')).toBeNull()
  })

  it('omits undefined query parameters instead of sending "undefined"', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    const client = clientWith(fetchImpl)

    await client.request('/employees', {
      query: { limit: 50, location_id: undefined, query: 'Абаев' },
    })

    const url = fetchImpl.mock.calls[0][0] as string
    expect(url).toContain('limit=50')
    expect(url).not.toContain('location_id')
  })
})

describe('204 responses', () => {
  it('resolves without attempting to parse a body', async () => {
    const client = clientWith(vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(client.request('/session', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})
