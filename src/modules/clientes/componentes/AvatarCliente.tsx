"use client";

import { useState } from "react";

import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { cn } from "@/lib/utils";

import { urlLogo } from "../logoCliente";

type Propiedades = { id: string; nombre: string; logoVersion?: string | null; className?: string };

/** Logo del cliente o, si no tiene o no carga, sus iniciales. Decorativo: el nombre va al lado. */
export function AvatarCliente({ id, nombre, logoVersion, className }: Propiedades) {
  const [fallo, setFallo] = useState<string | null>(null);
  if (!logoVersion || fallo === logoVersion) return <AvatarIniciales nombre={nombre} className={className} />;
  return (
    // El logo viene de nuestra API con caché por versión; next/image no aporta aquí.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlLogo(id, logoVersion)} alt="" aria-hidden="true" loading="lazy" decoding="async"
      onError={() => setFallo(logoVersion)}
      className={cn("size-9 shrink-0 rounded-full bg-white object-cover ring-1 ring-border", className)} />
  );
}
