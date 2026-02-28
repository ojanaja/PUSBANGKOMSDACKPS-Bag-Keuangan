import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiUrl, apiGet, apiPost, apiPut, apiDelete, apiFetch } from '@/shared/api/httpClient'

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
})
