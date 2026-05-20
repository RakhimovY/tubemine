"use client"

import { useState, type ReactNode } from "react"

type FaqItem = {
  q: string
  a: ReactNode
}

/*
  Verbatim port of the design's FAQ accordion behavior:
    - one item open at a time
    - first item open by default
    - smooth caret rotation + max-height transition (CSS owns the animation)
*/
export function LandingFaq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number>(0)

  return (
    <div className="accordion" id="faq-accordion">
      {items.map((item, i) => {
        const isOpen = i === openIndex
        return (
          <div
            key={i}
            className={isOpen ? "accordion-item is-open" : "accordion-item"}
          >
            <button
              type="button"
              className="accordion-trigger"
              aria-expanded={isOpen ? "true" : "false"}
              onClick={() => setOpenIndex(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <svg
                className="icon accordion-caret"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="accordion-content">
              <div className="accordion-content-inner">{item.a}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
