"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function FinalCtaSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const router = useRouter()
  
  const startNewTrip = () => {
    router.push("/meeting")
  }

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
      className={`py-24 md:py-32 border-t border-border/30 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="container mx-auto px-6 text-center">
        <Button
          size="lg"
          onClick={startNewTrip}
          className="bg-accent-blue hover:bg-accent-blue/90 text-foreground px-8 py-6 text-lg font-medium mb-6"
        >
          Start a Trip
        </Button>
        <p className="text-muted-foreground text-pretty">Planning should feel like a conversation—not a chore.</p>
      </div>
    </section>
  )
}
