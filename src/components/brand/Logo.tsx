import { cn } from "@/lib/utils";

/**
 * LogoMark — brasão moderno com barcode integrado.
 * Escudo clássico + dupla borda premium + ornamentos + barras de código de barras.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 52"
      className={cn("h-10 w-10 shrink-0", className)}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="omni-shield" x1="24" y1="1" x2="24" y2="51" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="var(--brand-deep)" />
          <stop offset="100%" stopColor="oklch(0.30 0.09 220)" />
        </linearGradient>
        <linearGradient id="omni-tbar" x1="0" y1="39" x2="0" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="var(--brand-glow)" stopOpacity="0.60" />
          <stop offset="100%" stopColor="var(--brand-glow)" />
        </linearGradient>
        <linearGradient id="omni-wbar" x1="0" y1="39" x2="0" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" stopOpacity="0.20" />
          <stop offset="100%" stopColor="white" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="omni-stroke" x1="24" y1="1" x2="24" y2="51" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="var(--brand-glow)" stopOpacity="0.90" />
          <stop offset="60%"  stopColor="var(--brand-glow)" stopOpacity="0.50" />
          <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0.30" />
        </linearGradient>
        <filter id="omni-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Escudo (shield) — corpo principal ── */}
      <path
        d="M6,4 L42,4 L42,29 C42,40 24,51 24,51 C24,51 6,40 6,29 Z"
        fill="url(#omni-shield)"
        stroke="url(#omni-stroke)"
        strokeWidth="1.1"
      />

      {/* Borda interna — detalhe duplo de brasão premium */}
      <path
        d="M9,7 L39,7 L39,28.5 C39,38.5 24,48.2 24,48.2 C24,48.2 9,38.5 9,28.5 Z"
        fill="none"
        stroke="var(--brand-glow)"
        strokeWidth="0.55"
        strokeOpacity="0.25"
      />

      {/* ── Chief (topo do brasão) — zona ornamental ── */}
      {/* Ornamentos: dois losangos nos cantos superiores */}
      <polygon
        points="16,8.2  17.5,10.2  16,12.2  14.5,10.2"
        fill="var(--brand-glow)"
        opacity="0.60"
        filter="url(#omni-glow)"
      />
      <polygon
        points="32,8.2  33.5,10.2  32,12.2  30.5,10.2"
        fill="var(--brand-glow)"
        opacity="0.60"
        filter="url(#omni-glow)"
      />
      {/* Linha separadora do chief */}
      <line
        x1="10" y1="14" x2="38" y2="14"
        stroke="var(--brand-glow)"
        strokeWidth="0.75"
        strokeOpacity="0.32"
      />
      {/* Pequenos pontos/traços decorativos entre os losangos */}
      <circle cx="24" cy="10.2" r="0.9" fill="var(--brand-glow)" opacity="0.30" />

      {/* ── Barcode — zona central ── */}
      {/* 7 barras, pirâmide simétrica, anchoradas em y=39 */}

      {/* Barra 1 — white, curta */}
      <rect x="12.5" y="31" width="2.3" height="8"  rx="0.65" fill="url(#omni-wbar)" />
      {/* Barra 2 — white, média */}
      <rect x="16.1" y="25" width="2.3" height="14" rx="0.65" fill="url(#omni-wbar)" />
      {/* Barra 3 — teal, alta */}
      <rect x="19.7" y="19" width="2.3" height="20" rx="0.65" fill="url(#omni-tbar)" />
      {/* Barra 4 — teal, MAIOR (centro) */}
      <rect x="23.3" y="16" width="2.3" height="23" rx="0.65" fill="url(#omni-tbar)" />
      {/* Barra 5 — teal, alta */}
      <rect x="26.9" y="19" width="2.3" height="20" rx="0.65" fill="url(#omni-tbar)" />
      {/* Barra 6 — white, média */}
      <rect x="30.5" y="25" width="2.3" height="14" rx="0.65" fill="url(#omni-wbar)" />
      {/* Barra 7 — white, curta */}
      <rect x="34.1" y="31" width="2.3" height="8"  rx="0.65" fill="url(#omni-wbar)" />

      {/* Linha de escaneamento — detalhe sutil sobre as barras */}
      <line
        x1="11.5" y1="30" x2="36.5" y2="30"
        stroke="var(--brand-glow)"
        strokeWidth="0.5"
        strokeOpacity="0.18"
        strokeDasharray="1.5 1.5"
      />

      {/* Linha separadora inferior */}
      <line
        x1="10" y1="40" x2="38" y2="40"
        stroke="var(--brand-glow)"
        strokeWidth="0.75"
        strokeOpacity="0.32"
      />

      {/* ── Base do escudo — "360" pequeno ── */}
      <text
        x="24"
        y="46.5"
        textAnchor="middle"
        fill="var(--brand-glow)"
        fontSize="4.8"
        fontWeight="700"
        fontFamily="Sora, system-ui, sans-serif"
        letterSpacing="0.8"
        opacity="0.72"
      >
        360
      </text>
    </svg>
  );
}

/** Logo horizontal — para sidebar e login. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="select-none leading-none">
        <div
          className={cn(
            "font-display text-[17px] font-bold tracking-tight",
            light ? "text-primary-foreground" : "text-foreground",
          )}
        >
          OmniSafe{" "}
          <span className="text-brand-glow">360</span>
        </div>
        <div
          className={cn(
            "mt-[3px] text-[10px] font-semibold uppercase tracking-[0.22em]",
            light ? "text-primary-foreground/55" : "text-muted-foreground",
          )}
        >
          Gestão de estoque
        </div>
      </div>
    </div>
  );
}

/** Logo empilhada — splash screen, loading, impressos. */
export function LogoStacked({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <LogoMark className="h-20 w-20" />
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
            "mt-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
            light ? "text-primary-foreground/55" : "text-muted-foreground",
          )}
        >
          Gestão de estoque
        </div>
      </div>
    </div>
  );
}

/** LogoWordmark — somente tipografia, sem ícone. */
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
      <span className={cn("font-bold", light ? "text-primary-foreground/70" : "text-muted-foreground")}>
        360
      </span>
    </div>
  );
}
