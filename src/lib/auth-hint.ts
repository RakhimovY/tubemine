const KEY = "tubemine:auth-hint"

export type AuthState = "signed-in" | "anonymous"
type AuthHint = AuthState

export function getAuthHint(): AuthHint | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v === "signed-in" || v === "anonymous" ? v : null
  } catch {
    return null
  }
}

export function setAuthHint(state: AuthState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, state)
  } catch {
    // ignore (private browsing, quota exceeded, etc.)
  }
}

export function clearAuthHint(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
