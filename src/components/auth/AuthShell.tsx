import type { ReactNode } from "react";
import { Boxes, CalendarClock, ScanBarcode, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const highlights = [
  { icon: Boxes, text: "Depósito e gôndola sob controle, em tempo real" },
  { icon: CalendarClock, text: "Alertas de validade por lote antes de vencer" },
  { icon: ScanBarcode, text: "PDV integrado que avisa o repositor no mínimo" },
  { icon: ShieldCheck, text: "Conferência cega no recebimento e na reposição" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-brand p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-primary-foreground/10" />
        <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full border border-primary-foreground/10" />
        <Logo light />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight text-primary-foreground">
            Seu estoque inteiro, <br />numa visão 360°.
          </h1>
          <p className="mt-4 text-primary-foreground/75">
            Para supermercados, farmácias, sorveterias, lojas de roupas e todo tipo de comércio.
          </p>
          <ul className="mt-10 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/50">© 2026 OmniSafe 360</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

export function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-input bg-card font-semibold text-foreground transition hover:bg-muted"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
      {label}
    </button>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
      <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
    </div>
  );
}
