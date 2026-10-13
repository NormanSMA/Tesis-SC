"use client";

import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";

import { LIMITE_CSV_BYTES, type ResultadoImportacion, type TipoImportacion } from "../tipos";

const ETIQUETAS = { clientes: "Clientes", materiales: "Materiales" };
type Estado = "reposo" | "leyendo" | "validando" | "importando";

function leerArchivo(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onabort = () => reject(new Error("Se canceló la lectura del archivo."));
    lector.onload = () => {
      try {
        if (!(lector.result instanceof ArrayBuffer)) throw new Error("No se pudo leer el archivo.");
        resolve(new TextDecoder("utf-8", { fatal: true }).decode(lector.result));
      } catch {
        reject(new Error("Seleccione un archivo CSV con codificación UTF-8."));
      }
    };
    lector.readAsArrayBuffer(archivo);
  });
}

async function solicitarImportacion(peticion: { tipo: TipoImportacion; texto: string; confirmar: boolean }): Promise<ResultadoImportacion> {
  const respuesta = await fetch(`/api/v1/importaciones/${peticion.tipo}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto: peticion.texto, confirmar: peticion.confirmar }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? "No se pudo procesar el CSV.");
  return cuerpo.datos;
}

function useImportacion(tipos: TipoImportacion[], inicial?: TipoImportacion) {
  const [tipo, setTipo] = useState(inicial && tipos.includes(inicial) ? inicial : tipos[0]);
  const [texto, setTexto] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("reposo");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  function cambiarTipo(nuevo: TipoImportacion) {
    setTipo(nuevo); setTexto(null); setResultado(null); setError("");
  }

  async function elegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    setTexto(null); setResultado(null); setError("");
    if (!elegido) return;
    if (!elegido.name.toLowerCase().endsWith(".csv") || elegido.size > LIMITE_CSV_BYTES) {
      setError("Seleccione un archivo .csv de hasta 1 000 000 de bytes."); return;
    }
    setEstado("leyendo");
    try { setTexto(await leerArchivo(elegido)); }
    catch (problema) { setError(problema instanceof Error ? problema.message : "No se pudo leer el archivo."); }
    finally { setEstado("reposo"); }
  }

  async function enviar(confirmar: boolean) {
    if (estado !== "reposo" || texto === null || !tipo) return;
    setEstado(confirmar ? "importando" : "validando"); setError("");
    try {
      setResultado(await solicitarImportacion({ tipo, texto, confirmar }));
    } catch (problema) {
      setResultado(null);
      setError(problema instanceof Error ? problema.message : "No se pudo procesar el CSV.");
    } finally { setEstado("reposo"); }
  }

  return { tipo, texto, estado, error, resultado, cambiarTipo, elegirArchivo, enviar };
}

function Resultado({ resultado }: { resultado: ResultadoImportacion }) {
  const incidencias = [...resultado.errores.map((fila) => ({ ...fila, tipo: "Error" })),
    ...resultado.duplicados.map((fila) => ({ ...fila, tipo: "Duplicado" }))];
  return <section className="space-y-4" aria-label="Resultado de la importación">
    <p role="status" aria-live="polite">
      {resultado.confirmado
        ? `Importación completada: ${resultado.creadas} filas importadas, ${resultado.omitidasDuplicadas} omitidas, ${resultado.conError} con error`
        : `Validación completada. ${resultado.total} filas: ${resultado.validas.length} válidas, ${resultado.conError} con error, ${resultado.omitidasDuplicadas} duplicadas omitidas.`}
    </p>
    {incidencias.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="mb-2 text-left font-semibold">Errores y duplicados del CSV</caption>
      <thead><tr><th scope="col" className="p-2">Fila de origen</th>
        <th scope="col" className="p-2">Tipo</th><th scope="col" className="p-2">Mensaje</th></tr></thead>
      <tbody>{incidencias.map((incidencia, indice) => <tr key={`${incidencia.fila}-${indice}`} className="border-t">
        <th scope="row" className="p-2">{incidencia.fila}</th><td className="p-2">{incidencia.tipo}</td>
        <td className="p-2">{incidencia.mensaje}</td></tr>)}</tbody>
    </table></div> : null}
  </section>;
}

export function ImportadorCsv({ tipos, inicial }: { tipos: TipoImportacion[]; inicial?: TipoImportacion }) {
  const datos = useImportacion(tipos, inicial);
  const ocupado = datos.estado !== "reposo";
  const validas = datos.resultado?.validas.length ?? 0;
  return <div className="max-w-4xl space-y-5" aria-busy={ocupado}>
    <p id="ayuda-csv">Seleccione un CSV UTF-8 con separador coma y los encabezados de la plantilla.
      Máximo: 500 filas y 1 000 000 de bytes. Cada fila se importa en su propia transacción.</p>
    <fieldset disabled={ocupado} className="space-y-5">
      <legend className="sr-only">Importación piloto de CSV</legend>
      <div className="space-y-2"><label htmlFor="tipo-importacion" className="block font-medium">Tipo de datos</label>
        <select id="tipo-importacion" value={datos.tipo} className="rounded-md border bg-background p-2"
          onChange={(evento) => datos.cambiarTipo(evento.target.value as TipoImportacion)}>
          {tipos.map((tipo) => <option key={tipo} value={tipo}>{ETIQUETAS[tipo]}</option>)}
        </select></div>
      <Button asChild variant="outline"><a href={`/plantillas/${datos.tipo}.csv`} download>Descargar plantilla</a></Button>
      <div className="space-y-2"><label htmlFor="archivo-csv" className="block font-medium">Archivo CSV</label>
        <input key={datos.tipo} id="archivo-csv" type="file" accept=".csv,text/csv" aria-describedby="ayuda-csv"
          className="block w-full rounded-md border p-3" onChange={datos.elegirArchivo} /></div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={datos.texto === null} onClick={() => datos.enviar(false)}>Validar</Button>
        {validas > 0 && !datos.resultado?.confirmado ? <Button type="button" onClick={() => datos.enviar(true)}>
          Importar {validas} {validas === 1 ? "fila" : "filas"}</Button> : null}
      </div>
    </fieldset>
    <p role="status" aria-live="polite">{ocupado ? datos.estado === "leyendo" ? "Leyendo archivo…"
      : datos.estado === "validando" ? "Validando CSV…" : "Importando filas…"
      : datos.texto === null ? "Seleccione un archivo para comenzar." : ""}</p>
    {datos.error ? <p role="alert" className="text-destructive">{datos.error}</p> : null}
    {datos.resultado ? <Resultado resultado={datos.resultado} /> : null}
  </div>;
}
