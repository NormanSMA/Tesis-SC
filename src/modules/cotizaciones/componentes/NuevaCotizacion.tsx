"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/comunes/FormField";
import { CuerpoFormulario, PieFormulario, SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { Button } from "@/components/ui/button";
import { MONEDAS, convertirDesdeCordobas, type Moneda } from "@/core/moneda";
import { calcularVista } from "../calculo";
import { nombreMoneda } from "../moneda";
import { conInstalacion, costoInstalacion, kilometrosCobrados } from "../instalacion";
import { esquemaCrearCotizacion, type EntradaReemplazarItems } from "../schema";
import type { PorcentajesTarifa, Tarifa } from "../tarifas";
import type { SelectoresEditor } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoMostrarCondiciones, CampoTarifa } from "./CamposComerciales";
import { CamposInstalacion, entradaInstalacion, INSTALACION_VACIA } from "./CamposInstalacion";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";
import { aMonedaCotizacion, CamposPartidas } from "./EditorItems";
import { ModalClienteRapido } from "./ModalClienteRapido";
import { SelectorCliente, type OpcionCliente } from "./SelectorCliente";
import { TotalesCotizacion } from "./TotalesCotizacion";

type Propiedades = {
  clientes: OpcionCliente[]; clienteId?: string; puedeCrearCliente: boolean;
  condiciones: string; moneda: Moneda; tipoCambioUsd: string | null;
  selectores: SelectoresEditor; tarifas: PorcentajesTarifa; tarifaInstalacion: string;
};

function useNuevaCotizacion(propiedades: Propiedades) {
  const [datos, setDatos] = useState({ clienteId: propiedades.clienteId ?? "", asunto: "", moneda: propiedades.moneda,
    tarifa: "OCASIONAL" as Tarifa, descuento: "", mostrarCondiciones: false, condiciones: propiedades.condiciones });
  const actualizar = <K extends keyof typeof datos>(campo: K, valor: (typeof datos)[K]) =>
    { setDatos((anterior) => ({ ...anterior, [campo]: valor })); if (campo === "moneda") setInstalacion(anterior => ({ ...anterior, tarifa: "" })); };
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [instalacion, setInstalacion] = useState(INSTALACION_VACIA);
  const formulario = useForm<EntradaReemplazarItems>({ defaultValues: { version: "", items: [] } });
  const items = useWatch({ control: formulario.control, name: "items" });
  const solicitud = useSolicitudCotizacion("nueva-cotizacion");
  const tipoCambio = datos.moneda === "USD" ? propiedades.tipoCambioUsd : "1";
  const tarifaInstalacion = convertirDesdeCordobas(propiedades.tarifaInstalacion, tipoCambio ?? "1", 2);
  const datosInstalacion = entradaInstalacion(instalacion, tarifaInstalacion);
  const instalacionTotal = costoInstalacion(datosInstalacion.manoObra, kilometrosCobrados(datosInstalacion.km, datosInstalacion.idaVuelta), datosInstalacion.tarifa ?? tarifaInstalacion);
  const selectores = useMemo(() => aMonedaCotizacion(propiedades.selectores, tipoCambio ?? "1"), [propiedades.selectores, tipoCambio]);
  const porcentaje = datos.descuento.trim() || propiedades.tarifas[datos.tarifa];
  const vista = calcularVista({ items, originales: [], selectores, descuento: "0", descuentoPct: porcentaje, tasaImpuesto: "0" });

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const { descuento, ...cabecera } = datos;
    const cuerpo = { ...cabecera, items: formulario.getValues("items"), descuentoPct: descuento.trim() || undefined, instalacion: datosInstalacion };
    const validacion = { ...erroresEsquema(esquemaCrearCotizacion, cuerpo), ...vista.errores };
    if (tipoCambio === null) validacion.moneda = "Configure el tipo de cambio para cotizar en dólares.";
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("nueva-cotizacion"); return; }
    await solicitud.enviar({ url: "/api/v1/cotizaciones", metodo: "POST", cuerpo, destino: "detalle" });
  }
  return { datos, actualizar, formulario, selectores, solicitud, guardar, campos: { ...errores, ...solicitud.campos }, vista, porcentaje,
    instalacion, setInstalacion, tarifaInstalacion, instalacionTotal };
}

function ClienteDeCotizacion({ propiedades, editor }: { propiedades: Propiedades; editor: ReturnType<typeof useNuevaCotizacion> }) {
  const [opciones, setOpciones] = useState(propiedades.clientes);
  const [modal, setModal] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  function abrir(nombre = "") { setNombreNuevo(nombre); setModal(true); }
  return <>
    <div className="flex flex-wrap items-end gap-3">
      <FormField id="clienteId" etiqueta="Cliente" requerido error={editor.campos.clienteId} className="min-w-56 flex-1">
        {(atributos) => <SelectorCliente atributos={atributos} valor={editor.datos.clienteId} opciones={opciones}
          alCambiar={(id) => editor.actualizar("clienteId", id)} alCrear={propiedades.puedeCrearCliente ? abrir : undefined} />}
      </FormField>
      {propiedades.puedeCrearCliente ? <Button id="nuevo-cliente-cotizacion" type="button" variant="outline"
        onClick={() => abrir()}>Nuevo cliente</Button> : null}
    </div>
    <ModalClienteRapido abierto={modal} alCambiar={setModal} nombreInicial={nombreNuevo} alGuardar={(cliente) => {
      setOpciones((anteriores) => [...anteriores, cliente]); editor.actualizar("clienteId", cliente.id); setModal(false);
    }} />
  </>;
}

export function NuevaCotizacion(propiedades: Propiedades) {
  const editor = useNuevaCotizacion(propiedades);
  const { datos, actualizar, campos, solicitud } = editor;
  return <form id="nueva-cotizacion" aria-label="Nueva cotización" noValidate onSubmit={editor.guardar}>
    <CuerpoFormulario>
      <AvisoGuardado {...solicitud} />
      <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-6">
        <SeccionFormulario vertical titulo="Cliente y datos de la cotización">
          <ClienteDeCotizacion propiedades={propiedades} editor={editor} />
          <CampoTexto id="asunto" etiqueta="Asunto" requerido valor={datos.asunto} error={campos.asunto} alCambiar={(v) => actualizar("asunto", v)} />
          <CampoSeleccion id="moneda" etiqueta="Moneda" requerido valor={datos.moneda} error={campos.moneda}
            opciones={MONEDAS.map((id) => ({ id, nombre: nombreMoneda(id) }))} alCambiar={(v) => actualizar("moneda", v as Moneda)} />
        </SeccionFormulario>
        <SeccionFormulario vertical titulo="Productos y servicios" descripcion="Puede guardar un borrador vacío y agregar trabajos antes de enviarlo.">
          <CamposPartidas {...editor} moneda={datos.moneda} originales={[]} />
        </SeccionFormulario>
        <SeccionFormulario vertical titulo="Instalación" descripcion="El importe se incluye en el precio total. El desglose es de uso interno.">
          <CamposInstalacion valores={editor.instalacion} alCambiar={editor.setInstalacion} tarifa={editor.tarifaInstalacion}
            moneda={datos.moneda} errores={campos} />
        </SeccionFormulario>
        <SeccionFormulario vertical titulo="Tarifa y totales" descripcion="Si indica un descuento manual, ese porcentaje sustituye al de la tarifa.">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTarifa tarifa={datos.tarifa} porcentajes={propiedades.tarifas} alCambiar={(v) => actualizar("tarifa", v)} />
            <CampoTexto id="descuento-manual" etiqueta="Descuento manual (%)" decimal valor={datos.descuento}
              error={campos.descuentoPct} alCambiar={(v) => actualizar("descuento", v)} />
          </div>
          {editor.vista.totales ? <TotalesCotizacion totales={{ ...conInstalacion(editor.vista.totales, editor.instalacionTotal),
            descuentoPct: editor.porcentaje, instalacion: { total: editor.instalacionTotal } }}
            moneda={datos.moneda} /> : <p className="text-sm text-muted-foreground">Complete los trabajos para calcular el total.</p>}
        </SeccionFormulario>
        <SeccionFormulario vertical titulo="Condiciones comerciales">
          <CampoMostrarCondiciones mostrar={datos.mostrarCondiciones} condiciones={datos.condiciones} error={campos.condiciones}
            alMostrar={(v) => actualizar("mostrarCondiciones", v)} alCambiar={(v) => actualizar("condiciones", v)} />
        </SeccionFormulario>
      </fieldset>
    </CuerpoFormulario>
    <PieFormulario>
      <Button asChild variant="outline"><Link href="/cotizaciones">Cancelar</Link></Button>
      <Button type="submit" disabled={solicitud.enviando}>Guardar borrador</Button>
    </PieFormulario>
  </form>;
}
