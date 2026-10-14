import type { Prisma } from "@/generated/prisma/client";
import { aCotizacionDto, aTotalesDto } from "./dto";
import type { FichaGuardada } from "./repo";
import type { ItemDto } from "./tipos";

function instantanea(item: ItemDto): Prisma.InputJsonObject {
  return { secuencia: item.secuencia, descripcion: item.descripcion, tipo: item.tipo,
    productoId: item.productoId, categoriaId: item.categoriaId, unidadCobro: item.unidadCobro,
    cantidad: item.cantidad, ancho: item.ancho, alto: item.alto, precioUnitario: item.precioUnitario,
    costoTotal: item.costoTotal, margenPct: item.margenPct, importe: item.importe,
    lineas: item.lineas.map((linea) => ({ ...linea })) };
}

export function detalleItems(antes: FichaGuardada, despues: FichaGuardada): Prisma.InputJsonObject {
  const anteriores = aCotizacionDto(antes).items;
  const nuevos = aCotizacionDto(despues).items;
  const ids = new Set([...anteriores, ...nuevos].map(({ id }) => id));
  const cambios: Prisma.InputJsonObject[] = [];
  for (const itemId of ids) {
    const anterior = anteriores.find(({ id }) => id === itemId);
    const nuevo = nuevos.find(({ id }) => id === itemId);
    const valorAnterior = anterior ? instantanea(anterior) : null;
    const valorNuevo = nuevo ? instantanea(nuevo) : null;
    if (JSON.stringify(valorAnterior) === JSON.stringify(valorNuevo)) continue;
    cambios.push({ accion: !anterior ? "agregado" : !nuevo ? "quitado" : "modificado", itemId,
      secuencia: (nuevo ?? anterior)!.secuencia, descripcion: (nuevo ?? anterior)!.descripcion,
      anterior: valorAnterior, nuevo: valorNuevo });
  }
  return { cambios: {}, items: cambios, totales: { anterior: aTotalesDto(antes), nuevo: aTotalesDto(despues) } };
}

export function detalleCabecera(antes: FichaGuardada, despues: FichaGuardada): Prisma.InputJsonObject {
  const campos = ["asunto", "condiciones", "descuento", "descuentoPct", "vigenciaDias"] as const;
  const cambios: Record<string, Prisma.InputJsonValue> = {};
  for (const campo of campos) {
    const valor = (ficha: FichaGuardada) => campo === "descuento" ? ficha.descuento.toFixed(2)
      : campo === "descuentoPct" ? ficha.descuentoPct?.toFixed(2) ?? null : ficha[campo];
    const anterior = valor(antes);
    const nuevo = valor(despues);
    if (anterior !== nuevo) cambios[campo] = { anterior, nuevo };
  }
  return { cambios, totales: { anterior: aTotalesDto(antes), nuevo: aTotalesDto(despues) } };
}
