/** Anillo compacto con "completadas/total" en el centro. Ocupa menos que una barra en las listas. */
export function AvanceCircular({ completadas, total, etiqueta = "etapas completadas" }: {
  completadas: number; total: number; etiqueta?: string;
}) {
  const radio = 15;
  const circunferencia = 2 * Math.PI * radio;
  const fraccion = total > 0 ? Math.min(completadas / total, 1) : 0;
  return <span role="img" aria-label={`${completadas} de ${total} ${etiqueta}`} className="relative inline-flex size-10 shrink-0">
    <svg viewBox="0 0 36 36" className="size-10 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={radio} fill="none" strokeWidth="3" className="stroke-muted" />
      <circle cx="18" cy="18" r={radio} fill="none" strokeWidth="3" strokeLinecap="round"
        className={fraccion === 1 ? "stroke-success" : "stroke-primary"}
        strokeDasharray={circunferencia} strokeDashoffset={circunferencia * (1 - fraccion)} />
    </svg>
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
      {completadas}/{total}</span>
  </span>;
}
