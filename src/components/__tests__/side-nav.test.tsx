// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SideNav } from "../side-nav"

// Mock the next-intl navigation helpers so SideNav can render in a node-less
// router environment. usePathname returns the locale-stripped pathname; Link
// renders as a plain anchor for assertion purposes.
const pathnameMock = vi.fn()
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathnameMock(),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const baseLabels = {
  sidebarLabel: "Primary navigation",
  workspaceLabel: "Workspace",
  moreLabel: "More",
  navHome: "Home",
  navHistory: "History",
  navProfile: "Profile",
  navGithub: "GitHub",
  navDocs: "Docs",
  navSignOut: "Sign out",
}

describe("SideNav current-page highlight", () => {
  it("on /dashboard: marks Home active, History+Profile inactive", () => {
    pathnameMock.mockReturnValue("/dashboard")
    const { container } = render(
      <SideNav historyCount={3} labels={baseLabels} drawerOpen={false} />,
    )
    const home = container.querySelector('a[href="/dashboard"]')
    const history = container.querySelector('a[href="/history"]')
    const profile = container.querySelector('a[href="/profile"]')
    expect(home?.className).toContain("is-active")
    expect(home?.getAttribute("aria-current")).toBe("page")
    expect(history?.className).not.toContain("is-active")
    expect(profile?.className).not.toContain("is-active")
  })

  it("on /history: marks History active, badge shows historyCount", () => {
    pathnameMock.mockReturnValue("/history")
    const { container } = render(
      <SideNav historyCount={7} labels={baseLabels} drawerOpen={false} />,
    )
    const history = container.querySelector('a[href="/history"]')
    expect(history?.className).toContain("is-active")
    expect(history?.textContent).toContain("7")
  })

  it("on /profile: marks Profile active", () => {
    pathnameMock.mockReturnValue("/profile")
    const { container } = render(
      <SideNav historyCount={0} labels={baseLabels} drawerOpen={false} />,
    )
    const profile = container.querySelector('a[href="/profile"]')
    expect(profile?.className).toContain("is-active")
    expect(profile?.getAttribute("aria-current")).toBe("page")
  })

  it("drawerOpen toggles is-open class on the <aside>", () => {
    pathnameMock.mockReturnValue("/dashboard")
    const { container, rerender } = render(
      <SideNav historyCount={0} labels={baseLabels} drawerOpen={false} />,
    )
    const aside = container.querySelector("aside.sidebar")
    expect(aside?.className).not.toContain("is-open")
    rerender(<SideNav historyCount={0} labels={baseLabels} drawerOpen />)
    expect(container.querySelector("aside.sidebar")?.className).toContain("is-open")
  })

  it("history badge hidden when historyCount === 0", () => {
    pathnameMock.mockReturnValue("/dashboard")
    const { container } = render(
      <SideNav historyCount={0} labels={baseLabels} drawerOpen={false} />,
    )
    expect(container.querySelector('a[href="/history"] .count')).toBeNull()
  })
})
