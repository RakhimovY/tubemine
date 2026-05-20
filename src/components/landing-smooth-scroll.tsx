"use client"

import { useEffect } from "react"

/*
  In-page anchor smooth-scroll with sticky-nav offset.
  Mirrors the design HTML's vanilla JS: when an <a href="#id"> click happens,
  prevent default, scroll to the target minus 60px header height, and update
  history without a page jump.
*/
export function LandingSmoothScroll() {
  useEffect(() => {
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
      const top = dest.getBoundingClientRect().top + window.scrollY - 60
      window.scrollTo({ top, behavior: "smooth" })
      history.replaceState(null, "", "#" + id)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  return null
}
