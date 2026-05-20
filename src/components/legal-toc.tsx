"use client"

import { useEffect } from "react"

/*
  Sticky TOC client island for legal pages (/privacy, /terms).
  Mirrors the design HTML's vanilla JS exactly:
    - IntersectionObserver watches every <section[id]> in .legal-article
    - The topmost-visible section's matching .toc a[href="#id"] gets .is-active
    - In-page anchor clicks smooth-scroll with an 80px header offset
      (privacy/terms use a slightly bigger offset than the landing's 60px
      because the legal hero sits flush against the sticky nav, see HTML)
    - Updates history.replaceState so the URL hash stays accurate without a
      hard page jump
  Cleanup: disconnects observer + removes the document click listener.
*/
export function LegalToc() {
  useEffect(() => {
    const tocLinks = document.querySelectorAll<HTMLAnchorElement>(
      '.toc a[href^="#"]',
    )
    const sections = document.querySelectorAll<HTMLElement>(
      ".legal-article section[id]",
    )

    let io: IntersectionObserver | null = null
    if ("IntersectionObserver" in window && sections.length) {
      const byId: Record<string, HTMLAnchorElement> = {}
      tocLinks.forEach((a) => {
        const href = a.getAttribute("href")
        if (href && href.length > 1) byId[href.slice(1)] = a
      })
      const visible = new Set<string>()
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) visible.add(e.target.id)
            else visible.delete(e.target.id)
          })
          let topId: string | null = null
          let minTop = Infinity
          sections.forEach((s) => {
            if (!visible.has(s.id)) return
            const t = s.getBoundingClientRect().top
            if (t < minTop) {
              minTop = t
              topId = s.id
            }
          })
          tocLinks.forEach((a) => a.classList.remove("is-active"))
          if (topId && byId[topId]) byId[topId].classList.add("is-active")
        },
        { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
      )
      sections.forEach((s) => io!.observe(s))
    }

    function onClick(e: MouseEvent) {
      const target = e.target as Element | null
      const anchor = target?.closest('a[href^="#"]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.length < 2) return
      const id = href.slice(1)
      const dest = document.getElementById(id)
      if (!dest) return
      e.preventDefault()
      const top = dest.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top, behavior: "smooth" })
      history.replaceState(null, "", "#" + id)
    }
    document.addEventListener("click", onClick)

    return () => {
      io?.disconnect()
      document.removeEventListener("click", onClick)
    }
  }, [])
  return null
}
