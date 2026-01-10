"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const dots: { x: number; y: number; vx: number; vy: number }[] = []
    const numDots = 60

    for (let i = 0; i < numDots; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      })
    }

    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connecting lines
      ctx.strokeStyle = "rgba(99, 128, 255, 0.08)"
      ctx.lineWidth = 1
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw dots
      ctx.fillStyle = "rgba(99, 128, 255, 0.25)"
      for (const dot of dots) {
        dot.x += dot.vx
        dot.y += dot.vy

        if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1
        if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1

        ctx.beginPath()
        ctx.arc(dot.x, dot.y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-transparent opacity-60" />

      <div className="relative z-10 container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 animate-fade-in text-balance">
          Plan trips. Together. In real time.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-delay text-pretty">
          Turn live conversations into a shared itinerary—maps, places, and bookings update as you talk.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-delay-2">
          <Button
            size="lg"
            className="bg-accent-blue hover:bg-accent-blue/90 text-foreground px-8 py-6 text-lg font-medium"
          >
            Start a Trip
          </Button>
          <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            See how it works
          </Link>
        </div>
      </div>
    </section>
  )
}
