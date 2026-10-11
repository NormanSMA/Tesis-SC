import type { ReactNode } from "react";

/** Se vuelve a montar en cada navegación: da una entrada suave a la pantalla. */
export default function PlantillaApp({ children }: { children: ReactNode }) {
  return <div className="entrada-escalonada">{children}</div>;
}
