const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

type ApiErrorHandlers = {
    onUnauthorized?: () => void
    onServerError?: (message: string) => void
}

let apiErrorHandlers: ApiErrorHandlers = {}
let unauthorizedHandled = false

function isAbsoluteUrl(url: string) {
    return /^https?:\/\//i.test(url)
}

export function apiUrl(path: string): string {
    if (isAbsoluteUrl(path) || path.startsWith('/api/')) {
        return path
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE}${normalizedPath}`
}

function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export function configureApiErrorHandlers(handlers: ApiErrorHandlers) {
    apiErrorHandlers = handlers
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const csrfToken = getCookie('_csrf');
    if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
    }

    const response = await fetch(apiUrl(path), {
        credentials: 'include',
        ...init,
        headers,
    })

    if (response.status === 401 && !unauthorizedHandled) {
        unauthorizedHandled = true
        apiErrorHandlers.onUnauthorized?.()
        window.setTimeout(() => {
            unauthorizedHandled = false
        }, 750)
    }

    if (response.status >= 500) {
        apiErrorHandlers.onServerError?.('Terjadi gangguan pada server. Silakan coba lagi.')
    }

    return response
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await apiFetch(path, init)

    if (!response.ok) {
        throw new Error(`Permintaan gagal (${response.status})`)
    }

    return response.json() as Promise<T>
}

async function apiMutate<T>(path: string, method: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData

    const headers = new Headers(init?.headers)
    if (!isFormData && body !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    const response = await apiFetch(path, {
        ...init,
        method,
        headers,
        body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const message = (errData as Record<string, string>).error
            || (errData as Record<string, string>).message
            || `Permintaan gagal (${response.status})`
        throw new Error(message)
    }

    const text = await response.text()
    return text ? (JSON.parse(text) as T) : ({} as T)
}

export async function apiPost<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return apiMutate<T>(path, 'POST', body, init)
}

export async function apiPut<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return apiMutate<T>(path, 'PUT', body, init)
}

export async function apiDelete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return apiMutate<T>(path, 'DELETE', undefined, init)
}
