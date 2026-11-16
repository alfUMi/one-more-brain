import { describe, expect, it, vi } from 'vitest'
import { createApiClient, HttpError } from '../src/http'
import { RejectedError } from '../src/outbox'

function client(response: Response, token: string | null = 'tok') {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => response)
  const onUnauthorized = vi.fn()
  const api = createApiClient({
    baseUrl: 'https://brain.test',
    getToken: () => token,
    onUnauthorized,
    fetch: fetch as unknown as typeof globalThis.fetch,
  })
  return { api, fetch, onUnauthorized }
}

describe('createApiClient', () => {
  it('sends the bearer token and drops empty query values', async () => {
    const { api, fetch } = client(Response.json({ items: [], nextCursor: null }))
    await api.list({ status: 'INBOX', q: '', limit: 10 })
    expect(fetch).toHaveBeenCalledWith(
      'https://brain.test/api/v1/items?status=INBOX&limit=10',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      }),
    )
  })

  it('turns validation errors into RejectedError with the server message', async () => {
    const { api } = client(Response.json({ statusMessage: 'Bad tag' }, { status: 400 }))
    await expect(api.update('x', { tags: ['?'] })).rejects.toEqual(
      new RejectedError('Bad tag', 400),
    )
  })

  it('reports a revoked session and keeps 401 retryable', async () => {
    const { api, onUnauthorized } = client(new Response('', { status: 401 }))
    await expect(api.me()).rejects.toBeInstanceOf(HttpError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('exchanges a sign-in code without a token', async () => {
    const { api, fetch } = client(Response.json({ token: 'new' }), null)
    await expect(
      api.exchangeMobileCode({ code: 'c'.repeat(43), verifier: 'v'.repeat(43) }),
    ).resolves.toEqual({ token: 'new' })
    expect(fetch.mock.calls[0]![1]).not.toHaveProperty('headers.authorization')
  })

  it('returns null for 204', async () => {
    const { api } = client(new Response(null, { status: 204 }))
    await expect(api.remove('x')).resolves.toBeNull()
  })
})
