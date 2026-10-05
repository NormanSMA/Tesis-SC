import { cn } from "@/lib/utils";

export function Monograma({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="6" fill="var(--primary)" />
      <path
        d="M14.5 11.2c-.9-1.4-5.5-1.7-5.5 1.1 0 3.3 6 1.9 6 5.4 0 2.9-5.1 2.7-6.3.9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24.5 11.5a5.6 5.6 0 1 0 0 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Marca({ mostrarNombre = true, className }: { mostrarNombre?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Monograma />
      {mostrarNombre ? (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground">Soluciones Creativas</span>
          <span className="text-xs text-muted-foreground">Plataforma de gestión</span>
        </span>
      ) : null}
    </span>
  );
}
