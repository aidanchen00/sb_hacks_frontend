"use client"

import { useEffect, useRef, useState } from "react"

const steps = [
  {
    number: "01",
    title: "Create a Room",
    description: "Friends join a shared planning space.",
  },
  {
    number: "02",
    title: "Have the Conversation",
    description: "Destinations, dates, preferences—spoken naturally.",
  },
  {
    number: "03",
    title: "Leave with a Plan",
    description: "A clear itinerary, shared map, and confirmed bookings.",
  },
]

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="how-it-works" className="py-24 md:py-32 border-t border-border/30">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">How It Works</h2>
        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16.666%] right-[16.666%] h-px bg-gradient-to-r from-transparent via-accent-blue/30 to-transparent" />

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`relative text-center transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full border border-border/50 bg-card mb-6">
                  <span className="text-2xl font-bold text-accent-blue">{step.number}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
