import Link from "next/link"

export function Footer() {
  return (
    <footer className="py-12 border-t border-border/30">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-lg font-semibold text-foreground">Nomad</span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground/70">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/50 text-center mt-8">Demo experience</p>
      </div>
    </footer>
  )
}
