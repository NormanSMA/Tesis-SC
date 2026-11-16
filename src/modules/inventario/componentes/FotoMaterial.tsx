"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/comunes/FormField";
import { SeccionFormulario } from "@/components/comunes/SeccionFormulario";

async function leerFoto(archivo: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type) || archivo.size > 10 * 1024 * 1024) throw new Error("Use una foto PNG, JPEG o WebP de hasta 10 MB.");
  const imagen = await createImageBitmap(archivo);
  try {
    const proporcion = Math.min(1, 960 / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(imagen.width * proporcion)); lienzo.height = Math.max(1, Math.round(imagen.height * proporcion));
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("No se pudo preparar la foto.");
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const resultado = lienzo.toDataURL("image/webp", .75);
    if (resultado.length > 700000) throw new Error("La foto es demasiado compleja. Use una de menor resolución.");
    return resultado;
  } finally { imagen.close(); }
}

export function FotoMaterial({ actual, valor, error, alCambiar, alProcesar }: { actual?: string; valor?: string | null; error?: string; alCambiar: (foto: string | null) => void; alProcesar: (procesando: boolean) => void }) {
  const [fallo, setFallo] = useState<string>(), [procesando, setProcesando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const vista = valor === undefined ? actual : valor;
  return <SeccionFormulario titulo="Foto del material" descripcion="Opcional. Ayuda a identificarlo; se guarda junto con el material.">
    <div className="flex flex-wrap items-start gap-5">
      {/* La foto es privada y pertenece al mismo origen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vista ? <img src={vista} alt="Vista previa del material" className="size-32 rounded-lg border bg-card object-contain" /> : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Sin foto</p>}
      <div className="min-w-0 flex-1 space-y-3"><FormField id="fotoBase64" etiqueta="Seleccionar o reemplazar foto" ayuda="PNG, JPEG o WebP, hasta 10 MB. Se optimiza automáticamente." error={fallo ?? error}>
        {atributos => <Input {...atributos} ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" disabled={procesando} onChange={async e => {
          const foto = e.target.files?.[0]; if (!foto) return;
          setProcesando(true); alProcesar(true); setFallo(undefined);
          try { alCambiar(await leerFoto(foto)); } catch (error) { setFallo(error instanceof Error ? error.message : "No se pudo leer la foto."); }
          finally { setProcesando(false); alProcesar(false); if (archivo.current) archivo.current.value = ""; }
        }} />}</FormField>
        {vista ? <Button type="button" variant="outline" disabled={procesando} onClick={() => alCambiar(null)}>Quitar foto</Button> : null}
        {procesando ? <p role="status">Preparando foto…</p> : null}
      </div>
    </div>
  </SeccionFormulario>;
}
