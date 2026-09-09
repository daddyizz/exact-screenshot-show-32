import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function PublicPageLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-display text-sm font-bold tracking-tight">BlogPilot<span className="text-primary">.</span>AI</Link>
        <div className="flex gap-2"><Button variant="ghost" size="sm" asChild><Link to="/guides">Guides</Link></Button><Button variant="ghost" size="sm" asChild><Link to="/help">Help</Link></Button><Button size="sm" asChild><Link to="/auth" search={{ next: undefined }}>Get started</Link></Button></div>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="text-eyebrow">{eyebrow}</p>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
      <div className="mt-10 text-[15px] leading-7 text-muted-foreground
        [&_h2]:font-display [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground
        [&_h3]:font-display [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground
        [&_p]:my-4 [&_p]:leading-7
        [&_strong]:font-semibold [&_strong]:text-foreground
        [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:opacity-80
        [&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6
        [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6
        [&_li]:pl-1
        [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic
        [&_hr]:my-10 [&_hr]:border-border
        [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-foreground">
        {children}
      </div>
    </main>
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 py-8 text-sm text-muted-foreground">
        <Link to="/about" className="hover:text-foreground">About</Link><Link to="/guides" className="hover:text-foreground">Guides</Link><Link to="/help" className="hover:text-foreground">Help</Link><Link to="/privacy" className="hover:text-foreground">Privacy</Link><Link to="/terms" className="hover:text-foreground">Terms</Link><Link to="/contact" className="hover:text-foreground">Contact</Link><span className="ml-auto">© {new Date().getFullYear()} BlogPilot AI</span>
      </div>
    </footer>
  </div>;
}
