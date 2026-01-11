import { HeroSection } from "@/components/hero-section"
import { WhySection } from "@/components/why-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { SocialProofSection } from "@/components/social-proof-section"
import { SponsorsSection } from "@/components/sponsors-section"
import { FinalCtaSection } from "@/components/final-cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <HeroSection />
      <SponsorsSection />
      <WhySection />
      <HowItWorksSection />
      <SocialProofSection />
      <FinalCtaSection />
      <Footer />
    </main>
  )
}
