import { useEffect } from "react";

export function useCerrarConEscape(activo: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [activo, cerrar]);
}
