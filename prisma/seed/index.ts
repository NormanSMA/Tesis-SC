import { crearCliente } from "../../src/lib/db";
import { cargarArchivosDeEntorno } from "./entorno";
import { escribir, tabla } from "./salida";
import { sembrar } from "./sembrar";
import { imprimirVerificacion, verificarSiembra } from "./verificar";

async function main(): Promise<number> {
  cargarArchivosDeEntorno();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
  const db = crearCliente(url);
  try {
    const resultado = await sembrar(db, { env: process.env });
    if (resultado.omitida) return 0;
    escribir();
    const filas = resultado.documentos.map((d) => [d.escenario, d.cotizacion, d.estadoCotizacion, d.orden ?? "-", d.estadoOrden ?? "-"]);
    for (const linea of tabla([["Escenario", "Cotización", "Estado", "Orden", "Estado de la orden"], ...filas])) escribir(linea);
    escribir();
    const verificacion = await verificarSiembra(db);
    imprimirVerificacion(verificacion);
    return verificacion.ok ? 0 : 1;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (error: unknown) => {
    process.stderr.write(`La siembra falló: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
