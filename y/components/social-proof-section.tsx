"use client"

import { useEffect, useRef, useState } from "react"

const features = ["Live collaboration", "Real-time maps", "Global payments"]

export function SocialProofSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className={`py-20 border-t border-border/30 transition-all duration-700 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="container mx-auto px-6 text-center">
        <p className="text-lg text-foreground mb-8">Built for modern group travel.</p>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
          {features.map((feature) => (
            <span key={feature} className="text-sm text-muted-foreground/70">
              {feature}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
