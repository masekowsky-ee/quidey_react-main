export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Reqest Failed");
    }

    return response.json();
}