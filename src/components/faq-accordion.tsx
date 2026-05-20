"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export interface FaqItem {
  question: string
  answer: string
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  return (
    <ul className="divide-y divide-border rounded-lg border border-border/60 bg-card/30">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        return (
          <li key={idx}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-medium hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            >
              <span>{item.question}</span>
              <ChevronDown
                aria-hidden
                className={`size-4 shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className="grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
