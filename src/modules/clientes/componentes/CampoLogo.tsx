"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { Button } from "@/components/ui/button";

import { prepararLogo, TIPOS_LOGO, urlLogo, type CambioLogo } from "../logoCliente";

type Propiedades = {
  id?: string; nombre: string; logoVersion?: string | null;
  cambio: CambioLogo; alCambiar: (cambio: CambioLogo) => void;
};

/** Logo opcional: vista previa, subir y quitar. El cambio se guarda junto con el cliente. */
export function CampoLogo({ id, nombre, logoVersion, cambio, alCambiar }: Propiedades) {
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();
  const [error, setError] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const vista = cambio?.tipo === "nuevo" ? cambio.vista : cambio?.tipo === "quitar" || !id || !logoVersion ? null : urlLogo(id, logoVersion);
  // Libera la URL temporal de la vista previa al reemplazarla o al salir.
  useEffect(() => () => { if (cambio?.tipo === "nuevo") URL.revokeObjectURL(cambio.vista); }, [cambio]);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null); setPreparando(true);
    try {
      const imagen = await prepararLogo(archivo);
      alCambiar({ tipo: "nuevo", imagen, vista: URL.createObjectURL(imagen) });
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo leer la imagen.");
    } finally {
      setPreparando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {vista
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={vista} alt={`Logo de ${nombre || "el cliente"}`} className="size-16 shrink-0 rounded-full bg-white object-cover ring-1 ring-border" />
        : <AvatarIniciales nombre={nombre || "Cliente"} className="size-16 text-base" />}
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">Logo o foto <span className="font-normal text-slate-500">(opcional)</span></p>
        <div className="flex flex-wrap gap-2">
          <input ref={entrada} id={`${idAyuda}-archivo`} type="file" accept={TIPOS_LOGO.join(",")} className="sr-only"
            aria-describedby={idAyuda} onChange={(evento) => void elegir(evento.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={preparando} onClick={() => entrada.current?.click()}>
            <ImagePlus aria-hidden="true" />{vista ? "Cambiar logo" : "Subir logo"}
          </Button>
          {vista ? <Button type="button" variant="outline" size="sm" className="text-danger"
            onClick={() => { setError(null); alCambiar(logoVersion ? { tipo: "quitar" } : null); }}>
            <Trash2 aria-hidden="true" />Quitar
          </Button> : null}
        </div>
        <p id={idAyuda} className="text-xs text-slate-500">PNG, JPG o WebP. Se reduce a 256 px al guardar.</p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
