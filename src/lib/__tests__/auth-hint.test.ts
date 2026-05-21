// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearAuthHint,
  getAuthHint,
  setAuthHint,
  type AuthState,
} from "@/lib/auth-hint"

const KEY = "tubemine:auth-hint"

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("auth-hint", () => {
  it("returns null when nothing stored", () => {
    expect(getAuthHint()).toBeNull()
  })

  it("round-trips signed-in", () => {
    setAuthHint("signed-in")
    expect(window.localStorage.getItem(KEY)).toBe("signed-in")
    expect(getAuthHint()).toBe("signed-in")
  })

  it("round-trips anonymous", () => {
    setAuthHint("anonymous")
    expect(getAuthHint()).toBe("anonymous")
  })

  it("returns null for unknown stored value", () => {
    window.localStorage.setItem(KEY, "garbage")
    expect(getAuthHint()).toBeNull()
  })

  it("clears the hint", () => {
    setAuthHint("signed-in")
    clearAuthHint()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(getAuthHint()).toBeNull()
  })

  it("survives a throwing localStorage getter (private browsing)", () => {
    vi.spyOn(
      Object.getPrototypeOf(window.localStorage),
      "getItem",
    ).mockImplementation(() => {
      throw new Error("quota / blocked")
    })
    expect(getAuthHint()).toBeNull()
  })

  it("survives a throwing localStorage setter without throwing", () => {
    vi.spyOn(
      Object.getPrototypeOf(window.localStorage),
      "setItem",
    ).mockImplementation(() => {
      throw new Error("quota exceeded")
    })
    expect(() => setAuthHint("signed-in")).not.toThrow()
  })

  it("survives a throwing localStorage remover without throwing", () => {
    vi.spyOn(
      Object.getPrototypeOf(window.localStorage),
      "removeItem",
    ).mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(() => clearAuthHint()).not.toThrow()
  })

  it("AuthState type accepts the two valid states only (compile-time check)", () => {
    const a: AuthState = "signed-in"
    const b: AuthState = "anonymous"
    // @ts-expect-error - invalid state
    const c: AuthState = "other"
    expect(a).toBe("signed-in")
    expect(b).toBe("anonymous")
    expect(c).toBe("other")
  })
})
