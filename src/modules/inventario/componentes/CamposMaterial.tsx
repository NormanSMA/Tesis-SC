"use client";

import { FormField } from "@/components/comunes/FormField";
import { SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { AREAS_MATERIAL, nombreAreaMaterial } from "@/core/areas-material";
import { ETIQUETA_UNIDAD, etiquetar } from "../etiquetas";
import { Input } from "@/components/ui/input";
import { TIPOS_PRESENTACION, UNIDADES } from "../schema";

export type ValoresMaterial = { codigo: string; nombre: string; descripcion: string; unidad: string; areaProduccion: string;
  unidadCotizacion: string; areaUnidadInventario: string;
  stockMinimo: string; costoPromedio: string; tipoPresentacion: string; anchoPresentacion: string; largoPresentacion: string };
type Propiedades = { valores: ValoresMaterial; errores: Record<string, string>; editar: boolean; conExistencia: boolean;
  cambiar: (campo: keyof ValoresMaterial, valor: string) => void };

function CamposPresentacion({ valores, errores, cambiar }: Pick<Propiedades, "valores" | "errores" | "cambiar">) {
  if (valores.unidad !== "M2") return null;
  return <SeccionFormulario titulo="Presentación del material">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <FormField id="presentacion-tipo" etiqueta="Tipo de presentación" error={errores["presentacion.tipo"]}
        ayuda="Indique las medidas de un rollo o una lámina completa.">
        {(atributos) => <select {...atributos} value={valores.tipoPresentacion}
          className="h-11 w-full rounded-md border border-input bg-background px-3"
          onChange={(evento) => cambiar("tipoPresentacion", evento.target.value)}>
          <option value="">Sin presentación</option>
          {TIPOS_PRESENTACION.map((tipo) => <option key={tipo} value={tipo}>{tipo === "ROLLO" ? "Rollo" : "Lámina"}</option>)}
        </select>}
      </FormField>
      {valores.tipoPresentacion ? <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
        <FormField id="presentacion-ancho" etiqueta="Ancho (m)" requerido error={errores["presentacion.ancho"]}>
          {(atributos) => <Input {...atributos} inputMode="decimal" maxLength={8} value={valores.anchoPresentacion}
            onChange={(evento) => cambiar("anchoPresentacion", evento.target.value)} />}
        </FormField>
        <FormField id="presentacion-largo" etiqueta="Largo (m)" requerido error={errores["presentacion.largo"]}>
          {(atributos) => <Input {...atributos} inputMode="decimal" maxLength={8} value={valores.largoPresentacion}
            onChange={(evento) => cambiar("largoPresentacion", evento.target.value)} />}
        </FormField>
      </div> : null}
    </div>
  </SeccionFormulario>;
}

function CamposUnidadCotizacion({ valores, errores, cambiar }: Pick<Propiedades, "valores" | "errores" | "cambiar">) {
  const convertir = ["PLIEGO", "ROLLO"].includes(valores.unidad);
  const unidades = convertir ? [valores.unidad, "M2"] : [valores.unidad];
  return <SeccionFormulario titulo="Unidad para cotizaciones">
    <FormField id="unidadCotizacion" etiqueta="Unidad en Cotizaciones" error={errores.unidadCotizacion}
      ayuda="Al elegir m², la cantidad se toma de las medidas del trabajo. El precio se edita en Configuración.">
      {(atributos) => <select {...atributos} value={valores.unidadCotizacion}
        className="h-11 w-full rounded-md border border-input bg-background px-3"
        onChange={(evento) => cambiar("unidadCotizacion", evento.target.value)}>
        <option value="">Usar unidad de inventario</option>
        {unidades.map((unidad) => <option key={unidad} value={unidad}>{etiquetar(ETIQUETA_UNIDAD, unidad)}</option>)}
      </select>}
    </FormField>
    {convertir && valores.unidadCotizacion === "M2" ? <FormField id="areaUnidadInventario" etiqueta="Área de un pliego o rollo completo (m²)"
      requerido error={errores.areaUnidadInventario ?? errores.unidadCotizacion}>
      {(atributos) => <Input {...atributos} inputMode="decimal" value={valores.areaUnidadInventario}
        onChange={(evento) => cambiar("areaUnidadInventario", evento.target.value)} />}
    </FormField> : null}
  </SeccionFormulario>;
}

export function CamposMaterial({ valores, errores, editar, conExistencia, cambiar }: Propiedades) {
  return <><SeccionFormulario titulo="Identificación"><div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <FormField id="codigo" etiqueta="Código automático" ayuda="Se asigna al guardar según el área; después permanece fijo." error={errores.codigo}>{(atributos) =>
      <Input {...atributos} value={valores.codigo || "Se genera al guardar"} readOnly />}</FormField>
    <FormField id="nombre" etiqueta="Nombre" requerido error={errores.nombre}>{(atributos) =>
      <Input {...atributos} value={valores.nombre} maxLength={160} onChange={(e) => cambiar("nombre", e.target.value)} />}</FormField>
    <FormField id="unidad" etiqueta="Unidad" requerido error={errores.unidad} ayuda="La unidad permanece fija después del alta.">{(atributos) =>
      <select {...atributos} className="h-11 w-full rounded-md border border-input bg-background px-3" value={valores.unidad} disabled={editar}
        onChange={(e) => cambiar("unidad", e.target.value)}>{UNIDADES.map((unidad) => <option key={unidad} value={unidad}>{etiquetar(ETIQUETA_UNIDAD, unidad)}</option>)}</select>}</FormField>
    <FormField id="areaProduccion" etiqueta="Área principal de producción" error={errores.areaProduccion}
      ayuda="Esta clasificación agrupa el material en las nuevas órdenes de trabajo.">{(atributos) =>
        <select {...atributos} className="h-11 w-full rounded-md border border-input bg-background px-3" value={valores.areaProduccion}
          onChange={(e) => cambiar("areaProduccion", e.target.value)}>
          <option value="">Sin clasificar</option>
          {AREAS_MATERIAL.map((area) => <option key={area} value={area}>{nombreAreaMaterial(area)}</option>)}
        </select>}</FormField>
  </div></SeccionFormulario>
  <CamposPresentacion valores={valores} errores={errores} cambiar={cambiar} />
  <CamposUnidadCotizacion valores={valores} errores={errores} cambiar={cambiar} />
  <SeccionFormulario titulo="Existencias y costo"><div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <FormField id="stockMinimo" etiqueta="Stock mínimo" requerido error={errores.stockMinimo}>{(atributos) =>
      <Input {...atributos} inputMode="decimal" value={valores.stockMinimo} onChange={(e) => cambiar("stockMinimo", e.target.value)} />}</FormField>
    <FormField id="costoPromedio" etiqueta="Costo promedio (C$)" requerido error={errores.costoPromedio}
      ayuda={conExistencia ? "El costo cambia mediante entradas mientras hay existencia." : "Precio de referencia. Admite hasta 4 decimales."}>{(atributos) =>
      <Input {...atributos} inputMode="decimal" value={valores.costoPromedio} disabled={conExistencia}
        onChange={(e) => cambiar("costoPromedio", e.target.value)} />}</FormField>
    <FormField id="descripcion" etiqueta="Descripción" error={errores.descripcion} className="sm:col-span-2">{(atributos) =>
      <textarea {...atributos} className="min-h-24 w-full rounded-md border border-input bg-background p-3" maxLength={10000}
        value={valores.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} />}</FormField>
  </div></SeccionFormulario></>;
}
