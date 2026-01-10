"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, Eye, CheckCircle } from "lucide-react"

const features = [
  {
    icon: MessageSquare,
    title: "Talk Naturally",
    description: "Speak with friends like you normally would. No forms. No spreadsheets.",
  },
  {
    icon: Eye,
    title: "See Decisions Instantly",
    description: "Maps, hotels, food, and activities update live as ideas come up.",
  },
  {
    icon: CheckCircle,
    title: "Commit Together",
    description: "When the group agrees, plans lock in—no back-and-forth, no lost context.",
  },
]

export function WhySection() {
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
    <section ref={sectionRef} className="py-24 md:py-32 border-t border-border/30">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">Why NomadSync</h2>
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`text-center transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent-blue/10 mb-6">
                <feature.icon className="w-6 h-6 text-accent-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
