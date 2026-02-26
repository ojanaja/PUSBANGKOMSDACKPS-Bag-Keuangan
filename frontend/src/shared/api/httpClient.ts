export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        credentials: 'include',
        ...init,
    })

    if (!response.ok) {
        throw new Error(`Permintaan gagal (${response.status})`)
    }

    return response.json() as Promise<T>
}
