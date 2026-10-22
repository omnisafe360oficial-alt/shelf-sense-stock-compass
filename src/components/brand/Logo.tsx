import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-10 w-10", className)} aria-hidden>
      <defs>
        <linearGradient id="omni-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-glow)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="none" stroke="url(#omni-g)" strokeWidth="2.5" strokeDasharray="110 22" strokeLinecap="round" transform="rotate(-60 24 24)" />
      <path d="M24 9.5 L35 14 V23.5 C35 30.5 30.3 35.8 24 38.5 C17.7 35.8 13 30.5 13 23.5 V14 Z" fill="url(#omni-g)" />
      <path d="M19 24 L22.5 27.5 L29.5 20.5" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <div className={cn("font-display text-lg font-bold tracking-tight", light ? "text-primary-foreground" : "text-foreground")}>
          OmniSafe <span className="text-brand-glow">360</span>
        </div>
        <div className={cn("mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]", light ? "text-primary-foreground/60" : "text-muted-foreground")}>
          Gestão de estoque
        </div>
      </div>
    </div>
  );
}
