"use client";

/**
 * Secure API client with automatic CSRF token handling
 * All mutations (POST, PUT, DELETE, PATCH) automatically include CSRF token
 */

// Get CSRF token from cookie
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Store user data (non-sensitive, for UI only)
let cachedUser: { id: number; username: string; email: string; is_host: boolean } | null = null;

export function getCachedUser() {
  return cachedUser;
}

export function setCachedUser(user: typeof cachedUser) {
  cachedUser = user;
}

export function clearCachedUser() {
  cachedUser = null;
}

interface FetchOptions extends RequestInit {
  skipCsrf?: boolean;
}

/**
 * Secure fetch wrapper that:
 * 1. Includes credentials (cookies) automatically
 * 2. Adds CSRF token header for mutations
 * 3. Sets proper content-type for JSON
 */
export async function secureFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipCsrf = false, ...fetchOptions } = options;
  
  const headers = new Headers(fetchOptions.headers);
  
  // Set JSON content type if body is present and not FormData
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  // Add CSRF token for mutation requests
  const method = (fetchOptions.method || "GET").toUpperCase();
  if (!skipCsrf && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  return fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include", // Always send cookies
  });
}

/**
 * JSON API helper with automatic parsing
 */
export async function api<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const response = await secureFetch(url, options);
    const data = await response.json();
    
    // Handle auth errors
    if (response.status === 401) {
      clearCachedUser();
      // Redirect to login if not already there
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    
    return data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "Network error" };
  }
}

/**
 * Logout and clear all auth state
 */
export async function logout(): Promise<void> {
  try {
    await secureFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore errors during logout
  }
  
  clearCachedUser();
  
  // Clear any old localStorage tokens (cleanup from old system)
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  
  // Redirect to login
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Check if user is authenticated (has auth cookie)
 * Note: This is a client-side check only, server validates the actual token
 */
export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("auth_token=");
}
