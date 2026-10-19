"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { prepararLogo, TIPOS_LOGO, urlLogo, type AjusteLogo, type CambioLogo } from "../logoCliente";

type Propiedades = {
  id?: string; nombre: string; logoVersion?: string | null;
  cambio: CambioLogo; alCambiar: (cambio: CambioLogo) => void;
};

const AJUSTES: { valor: AjusteLogo; etiqueta: string; ayuda: string }[] = [
  { valor: "completo", etiqueta: "Mostrar completo", ayuda: "Para logos anchos: no se corta nada." },
  { valor: "recortar", etiqueta: "Recortar para llenar", ayuda: "Para fotos: llena el círculo." },
];

function Imagen({ vista, nombre, className }: { vista: string | null; nombre: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return vista ? <img src={vista} alt="" className={cn("shrink-0 rounded-full bg-white object-cover ring-1 ring-border", className)} />
    : <AvatarIniciales nombre={nombre || "Cliente"} className={className} />;
}

/** Cómo se verá el logo en la ficha y en la lista, con el nombre al lado como en la aplicación. */
function VistaPrevia({ vista, nombre }: { vista: string | null; nombre: string }) {
  const texto = nombre || "Nombre del cliente";
  return (
    <div aria-label="Vista previa del logo" role="group" className="grid gap-3 rounded-xl border border-dashed border-border bg-slate-50 p-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-slate-500">En la ficha</p>
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-card p-2.5 ring-1 ring-border/80">
          <Imagen vista={vista} nombre={nombre} className="size-12 text-sm" />
          <p className="truncate text-base font-semibold text-slate-900">{texto}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-slate-500">En la lista</p>
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-card p-2.5 ring-1 ring-border/80">
          <Imagen vista={vista} nombre={nombre} className="size-9 text-xs" />
          <p className="truncate text-sm font-medium text-primary">{texto}</p>
        </div>
      </div>
    </div>
  );
}

function SelectorAjuste({ nombre, ajuste, alCambiar }: { nombre: string; ajuste: AjusteLogo; alCambiar: (ajuste: AjusteLogo) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-slate-500">Ajuste</legend>
      <div className="flex flex-wrap gap-2">
        {AJUSTES.map((opcion) => <label key={opcion.valor} title={opcion.ayuda}
          className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            ajuste === opcion.valor ? "border-primary bg-primary/5 font-medium text-primary" : "border-border text-slate-600")}>
          <input type="radio" name={nombre} value={opcion.valor} checked={ajuste === opcion.valor} className="sr-only"
            onChange={() => alCambiar(opcion.valor)} />
          {opcion.etiqueta}
        </label>)}
      </div>
    </fieldset>
  );
}

/** Logo opcional: subir, elegir el ajuste, revisar la vista previa y quitar. El cambio se guarda junto con el cliente. */
export function CampoLogo({ id, nombre, logoVersion, cambio, alCambiar }: Propiedades) {
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ajuste, setAjuste] = useState<AjusteLogo>("completo");
  const [error, setError] = useState<string | null>(null); const [preparando, setPreparando] = useState(false);
  const vista = cambio?.tipo === "nuevo" ? cambio.vista : cambio?.tipo === "quitar" || !id || !logoVersion ? null : urlLogo(id, logoVersion);
  // Libera la URL temporal de la vista previa al reemplazarla o al salir.
  useEffect(() => () => { if (cambio?.tipo === "nuevo") URL.revokeObjectURL(cambio.vista); }, [cambio]);

  async function preparar(origen: File, modo: AjusteLogo) {
    setError(null); setPreparando(true);
    try {
      const imagen = await prepararLogo(origen, modo);
      alCambiar({ tipo: "nuevo", imagen, vista: URL.createObjectURL(imagen) });
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo leer la imagen.");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Imagen vista={vista} nombre={nombre} className="size-20 text-lg" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Logo o foto <span className="font-normal text-slate-500">(opcional)</span></p>
          <div className="flex flex-wrap gap-2">
            <input ref={entrada} type="file" accept={TIPOS_LOGO.join(",")} className="sr-only" aria-label="Archivo del logo"
              aria-describedby={idAyuda} onChange={(evento) => {
                const elegido = evento.target.files?.[0];
                evento.target.value = "";
                if (elegido) { setArchivo(elegido); void preparar(elegido, ajuste); }
              }} />
            <Button type="button" variant="outline" size="sm" disabled={preparando} onClick={() => entrada.current?.click()}>
              <ImagePlus aria-hidden="true" />{vista ? "Cambiar logo" : "Subir logo"}
            </Button>
            {vista ? <Button type="button" variant="outline" size="sm" className="text-danger"
              onClick={() => { setError(null); setArchivo(null); alCambiar(logoVersion ? { tipo: "quitar" } : null); }}>
              <Trash2 aria-hidden="true" />Quitar
            </Button> : null}
          </div>
          <p id={idAyuda} className="text-xs text-slate-500">PNG, JPG o WebP. Se guarda cuadrado de 256 px.</p>
        </div>
      </div>
      {archivo ? <SelectorAjuste nombre={`${idAyuda}-ajuste`} ajuste={ajuste}
        alCambiar={(modo) => { setAjuste(modo); void preparar(archivo, modo); }} /> : null}
      {vista || archivo ? <VistaPrevia vista={vista} nombre={nombre} /> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
