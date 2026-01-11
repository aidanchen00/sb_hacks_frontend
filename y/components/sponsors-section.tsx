"use client"

import Image from "next/image"

const sponsors = [
  {
    name: "Deepgram",
    logo: "/deepgram.png",
    url: "https://deepgram.com",
  },
  {
    name: "Gemini",
    logo: "/gemini.png",
    url: "https://gemini.google.com",
  },
  {
    name: "Solana",
    logo: "/solana.png",
    url: "https://solana.com",
  },
]

export function SponsorsSection() {
  return (
    <section className="py-16 px-4 bg-gradient-to-b from-background to-gray-900/50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Made Possible By
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Our Sponsors
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-primary to-purple-500 mx-auto rounded-full"></div>
        </div>

        {/* Sponsor Logos */}
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16 lg:gap-20">
          {sponsors.map((sponsor) => (
            <a
              key={sponsor.name}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center justify-center"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Logo container */}
              <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 transition-all duration-300 group-hover:border-primary/50 group-hover:bg-white/10 group-hover:scale-105 group-hover:-translate-y-1">
                <Image
                  src={sponsor.logo}
                  alt={sponsor.name}
                  width={120}
                  height={60}
                  className="h-12 md:h-16 w-auto object-contain filter brightness-90 group-hover:brightness-110 transition-all duration-300"
                />
              </div>
              
              {/* Sponsor name tooltip */}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {sponsor.name}
              </span>
            </a>
          ))}
        </div>

        {/* Subtle decoration */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Thank you to our amazing sponsors for supporting this project ✨
          </p>
        </div>
      </div>
    </section>
  )
}

