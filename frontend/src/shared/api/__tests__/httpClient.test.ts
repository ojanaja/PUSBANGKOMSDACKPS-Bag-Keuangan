import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    apiUrl,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    apiFetch,
    configureApiErrorHandlers,
} from '@/shared/api/httpClient'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '_csrf=test-csrf-token',
})

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('apiUrl', () => {
    it('prepends API base for relative paths', () => {
        const url = apiUrl('/paket')
        expect(url).toMatch(/\/api\/v1\/paket$/)
    })

    it('does not modify absolute URLs', () => {
        expect(apiUrl('https://example.com/data')).toBe('https://example.com/data')
    })

    it('does not modify /api/ paths', () => {
        expect(apiUrl('/api/v2/test')).toBe('/api/v2/test')
    })

    it('normalizes paths without leading slash', () => {
        const url = apiUrl('users')
        expect(url).toMatch(/\/api\/v1\/users$/)
    })
})

describe('apiFetch', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        configureApiErrorHandlers({})
        vi.useRealTimers()
    })

    it('includes credentials and CSRF header', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
        await apiFetch('/test')

        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [, init] = mockFetch.mock.calls[0]
        expect(init.credentials).toBe('include')
        const headers = init.headers as Headers
        expect(headers.get('X-CSRF-Token')).toBe('test-csrf-token')
    })

    it('does not set CSRF header when cookie is missing', async () => {
        document.cookie = ''
        mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

        await apiFetch('/test')

        const [, init] = mockFetch.mock.calls[0]
        const headers = init.headers as Headers
        expect(headers.get('X-CSRF-Token')).toBeNull()
    })

    it('does not set CSRF header when csrf cookie value is empty', async () => {
        document.cookie = '_csrf='
        mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

        await apiFetch('/test')

        const [, init] = mockFetch.mock.calls[0]
        const headers = init.headers as Headers
        expect(headers.get('X-CSRF-Token')).toBeNull()
    })

    it('calls unauthorized handler once in the debounce window', async () => {
        vi.useFakeTimers()
        const onUnauthorized = vi.fn()
        configureApiErrorHandlers({ onUnauthorized })
        mockFetch.mockResolvedValue(new Response('{}', { status: 401 }))

        await apiFetch('/auth-1')
        await apiFetch('/auth-2')

        expect(onUnauthorized).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(751)
        await apiFetch('/auth-3')
        expect(onUnauthorized).toHaveBeenCalledTimes(2)
    })

    it('calls server error handler for 5xx responses', async () => {
        const onServerError = vi.fn()
        configureApiErrorHandlers({ onServerError })
        mockFetch.mockResolvedValue(new Response('{}', { status: 500 }))

        await apiFetch('/server-error')

        expect(onServerError).toHaveBeenCalledWith('Terjadi gangguan pada server. Silakan coba lagi.')
    })
})

describe('apiGet', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    it('returns parsed JSON on success', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'Test' }))
        const data = await apiGet<{ id: number; name: string }>('/test')
        expect(data).toEqual({ id: 1, name: 'Test' })
    })

    it('throws on non-ok response', async () => {
        mockFetch.mockResolvedValue(jsonResponse({}, 404))
        await expect(apiGet('/test')).rejects.toThrow('Permintaan gagal (404)')
    })
})

describe('apiPost', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    it('sends JSON body with POST method', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ success: true }))
        await apiPost('/test', { name: 'hello' })

        const [, init] = mockFetch.mock.calls[0]
        expect(init.method).toBe('POST')
        expect(init.body).toBe(JSON.stringify({ name: 'hello' }))
        const headers = init.headers as Headers
        expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('sends FormData without Content-Type header', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ success: true }))
        const fd = new FormData()
        fd.append('file', 'test')
        await apiPost('/upload', fd)

        const [, init] = mockFetch.mock.calls[0]
        const headers = init.headers as Headers
        expect(headers.get('Content-Type')).toBeNull()
        expect(init.body).toBe(fd)
    })

    it('throws with server error message', async () => {
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify({ error: 'Duplikat data' }), { status: 409 })
        )
        await expect(apiPost('/test', {})).rejects.toThrow('Duplikat data')
    })

    it('throws using message field when error field is absent', async () => {
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify({ message: 'Validasi gagal' }), { status: 400 })
        )

        await expect(apiPost('/test', {})).rejects.toThrow('Validasi gagal')
    })

    it('throws with default status message when error payload is not parseable', async () => {
        mockFetch.mockResolvedValue(
            new Response('not-json', {
                status: 422,
                headers: { 'Content-Type': 'text/plain' },
            })
        )

        await expect(apiPost('/test', {})).rejects.toThrow('Permintaan gagal (422)')
    })
})

describe('apiPut', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    it('sends PUT request with JSON body', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ updated: true }))
        await apiPut('/test/1', { name: 'updated' })

        const [, init] = mockFetch.mock.calls[0]
        expect(init.method).toBe('PUT')
        expect(init.body).toBe(JSON.stringify({ name: 'updated' }))
    })
})

describe('apiDelete', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    it('sends DELETE request without body', async () => {
        mockFetch.mockResolvedValue(jsonResponse({}))
        await apiDelete('/test/1')

        const [, init] = mockFetch.mock.calls[0]
        expect(init.method).toBe('DELETE')
        expect(init.body).toBeUndefined()
    })

    it('returns empty object for empty response body', async () => {
        mockFetch.mockResolvedValue(new Response(null, { status: 204 }))

        const result = await apiDelete('/test/1')
        expect(result).toEqual({})
    })
})
