import { cn } from "@/lib/utils";

/**
 * LogoMark — prateleiras estilizadas em badge arredondado com acento 360°.
 * Funciona em light e dark porque usa CSS vars do design system.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-10 w-10 shrink-0", className)}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="omni-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-deep)" />
          <stop offset="55%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="oklch(0.38 0.1 210)" />
        </linearGradient>
        <linearGradient id="omni-shelf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand-glow)" />
          <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0.65" />
        </linearGradient>
        <clipPath id="omni-clip">
          <rect width="48" height="48" rx="12" />
        </clipPath>
      </defs>

      {/* Background badge */}
      <rect width="48" height="48" rx="12" fill="url(#omni-bg)" />

      {/* Arco 360° — concêntrico no canto superior-direito */}
      <g clipPath="url(#omni-clip)">
        <circle
          cx="48"
          cy="0"
          r="22"
          fill="none"
          stroke="var(--brand-glow)"
          strokeWidth="1.5"
          strokeOpacity="0.28"
        />
        <circle
          cx="48"
          cy="0"
          r="14.5"
          fill="none"
          stroke="var(--brand-glow)"
          strokeWidth="1.5"
          strokeOpacity="0.18"
        />
      </g>

      {/* ── Prateleira 1 (topo) ── */}
      <rect x="8" y="15.5" width="32" height="2.5" rx="1.25" fill="url(#omni-shelf)" />
      {/* Produtos */}
      <rect x="9" y="8.5"  width="6.5" height="7"   rx="1.5" fill="white" fillOpacity="0.88" />
      <rect x="17" y="10"  width="4.5" height="5.5"  rx="1.5" fill="white" fillOpacity="0.48" />
      <rect x="23.5" y="8.5" width="7"   height="7"   rx="1.5" fill="white" fillOpacity="0.72" />
      <rect x="32.5" y="10" width="6"   height="5.5"  rx="1.5" fill="var(--brand-glow)" fillOpacity="0.92" />

      {/* ── Prateleira 2 (meio) ── */}
      <rect x="8" y="29" width="32" height="2.5" rx="1.25" fill="url(#omni-shelf)" />
      {/* Produtos */}
      <rect x="9"   y="22"   width="5.5" height="7"   rx="1.5" fill="white" fillOpacity="0.62" />
      <rect x="16.5" y="21"  width="8"   height="8"   rx="1.5" fill="white" fillOpacity="0.88" />
      <rect x="27"  y="22"   width="5"   height="7"   rx="1.5" fill="var(--brand-glow)" fillOpacity="0.78" />
      <rect x="34"  y="22.5" width="5"   height="6.5" rx="1.5" fill="white" fillOpacity="0.48" />

      {/* ── Prateleira 3 (base) ── */}
      <rect x="8" y="41.5" width="32" height="2.5" rx="1.25" fill="url(#omni-shelf)" fillOpacity="0.62" />
      {/* Produtos */}
      <rect x="9"   y="35"  width="8"   height="6.5" rx="1.5" fill="white" fillOpacity="0.5" />
      <rect x="19"  y="36"  width="5"   height="5.5" rx="1.5" fill="var(--brand-glow)" fillOpacity="0.68" />
      <rect x="26"  y="35"  width="9.5" height="6.5" rx="1.5" fill="white" fillOpacity="0.42" />
    </svg>
  );
}

/** Logo horizontal — para sidebar, header e login. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="select-none leading-none">
        <div
          className={cn(
            "font-display text-lg font-bold tracking-tight",
            light ? "text-primary-foreground" : "text-foreground",
          )}
        >
          OmniSafe{" "}
          <span className="text-brand-glow">360</span>
        </div>
        <div
          className={cn(
            "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
            light ? "text-primary-foreground/55" : "text-muted-foreground",
          )}
        >
          Gestão de estoque
        </div>
      </div>
    </div>
  );
}

/** Logo empilhada — para splash screen, tela de carregamento ou impressos. */
export function LogoStacked({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <LogoMark className="h-16 w-16" />
      <div className="select-none text-center leading-none">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight",
            light ? "text-primary-foreground" : "text-foreground",
          )}
        >
          OmniSafe{" "}
          <span className="text-brand-glow">360</span>
        </div>
        <div
          className={cn(
            "mt-1 text-xs font-semibold uppercase tracking-[0.2em]",
            light ? "text-primary-foreground/55" : "text-muted-foreground",
          )}
        >
          Gestão de estoque
        </div>
      </div>
    </div>
  );
}

/**
 * LogoWordmark — somente o texto, sem ícone.
 * Útil em espaços muito estreitos onde o ícone ficaria pequeno demais.
 */
export function LogoWordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div
      className={cn(
        "select-none font-display text-xl font-bold tracking-tight",
        light ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      Omni<span className="text-brand-glow">Safe</span>{" "}
      <span
        className={cn(
          "font-display text-xl font-bold",
          light ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        360
      </span>
    </div>
  );
}
