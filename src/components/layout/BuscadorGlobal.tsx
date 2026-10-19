"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Boxes, Calculator, ClipboardCheck, CornerDownLeft, Plus, Search, UserCog, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { filtrarNavegacion, gruposNavegacion } from "./navegacion";

type Propiedades = { permisos: string[]; modo: "amplio" | "icono" };
type Resultado = { id: string; titulo: string; detalle?: string; destino: string; icono: LucideIcon };
type Grupo = { titulo: string; resultados: Resultado[]; fallo: boolean };
type Fila = Record<string, unknown> & { id: string };

// Cada módulo con su permiso: el buscador solo consulta lo que el perfil puede ver.
type Fuente = { clave: string; ruta: string; permiso: string; titulo: string; icono: LucideIcon;
  destino: (fila: Fila) => string; nombre: (fila: Fila) => string; detalle: (fila: Fila) => string };
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const FUENTES: Fuente[] = [
  { clave: "clientes", ruta: "clientes", permiso: "cliente:ver", titulo: "Clientes", icono: Users,
    destino: (fila) => `/clientes/${fila.id}`, nombre: (fila) => texto(fila.nombre), detalle: (fila) => texto(fila.codigoCliente) },
  { clave: "cotizaciones", ruta: "cotizaciones", permiso: "cotizacion:ver", titulo: "Cotizaciones", icono: Calculator,
    destino: (fila) => `/cotizaciones/${fila.id}`, nombre: (fila) => texto((fila.cliente as { nombre?: string } | undefined)?.nombre),
    detalle: (fila) => [texto(fila.numero), texto(fila.asunto)].filter(Boolean).join(" · ") },
  { clave: "ordenes", ruta: "ordenes", permiso: "orden:ver", titulo: "Órdenes", icono: ClipboardCheck,
    destino: (fila) => `/ordenes/${fila.id}`, nombre: (fila) => texto((fila.cliente as { nombre?: string } | undefined)?.nombre),
    detalle: (fila) => texto(fila.numero) },
  { clave: "productos", ruta: "productos", permiso: "catalogo:ver", titulo: "Productos", icono: BookOpen,
    destino: (fila) => `/catalogo/${fila.id}`, nombre: (fila) => texto(fila.nombre), detalle: (fila) => texto(fila.codigo) },
  { clave: "materiales", ruta: "materiales", permiso: "inventario:ver", titulo: "Materiales", icono: Boxes,
    destino: (fila) => `/inventario/${fila.id}`, nombre: (fila) => texto(fila.nombre), detalle: (fila) => texto(fila.codigo) },
  { clave: "usuarios", ruta: "usuarios", permiso: "usuario:gestionar", titulo: "Usuarios", icono: UserCog,
    destino: (fila) => `/admin/usuarios/${fila.id}`, nombre: (fila) => texto(fila.nombre), detalle: (fila) => texto(fila.correo) },
];
/** "Buscar clientes, productos u órdenes": nombra solo los módulos que el perfil puede consultar. */
function marcadorBusqueda(permisos: string[]): string {
  const nombres = FUENTES.filter(({ permiso }) => permisos.includes(permiso)).map(({ titulo }) => titulo.toLowerCase());
  if (!nombres.length) return "Buscar secciones";
  if (nombres.length === 1) return `Buscar ${nombres[0]} o secciones`;
  const ultimo = nombres.pop()!;
  return `Buscar ${nombres.join(", ")} ${/^h?[oó]/i.test(ultimo) ? "u" : "o"} ${ultimo}`;
}
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Secciones del menú y acciones rápidas según permisos: se muestran sin escribir y se filtran al escribir.
function accesos(permisos: string[], consulta: string): Resultado[] {
  const secciones: Resultado[] = filtrarNavegacion(gruposNavegacion, permisos).flatMap(({ items }) => items)
    .map(({ href, etiqueta, icono }) => ({ id: `ir-${href}`, titulo: etiqueta, detalle: "Ir a la sección", destino: href, icono }));
  const acciones: Resultado[] = permisos.includes("cotizacion:gestionar")
    ? [{ id: "accion-nueva-cotizacion", titulo: "Nueva cotización", detalle: "Acción", destino: "/cotizaciones?crear=1", icono: Plus }] : [];
  const busqueda = normalizar(consulta.trim());
  return [...acciones, ...secciones].filter(({ titulo }) => !busqueda || normalizar(titulo).includes(busqueda));
}

async function buscarGrupo(fuente: Fuente, consulta: string, signal: AbortSignal): Promise<Grupo> {
  try {
    const parametros = new URLSearchParams({ q: consulta, porPagina: "5" });
    const respuesta = await fetch(`/api/v1/${fuente.ruta}?${parametros}`, { signal, cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo completar la búsqueda.");
    const cuerpo: { datos: Fila[] } = await respuesta.json();
    const resultados = cuerpo.datos.slice(0, 5).map((fila) => ({
      id: `${fuente.clave}-${fila.id}`, destino: fuente.destino(fila), icono: fuente.icono,
      titulo: fuente.nombre(fila) || fuente.detalle(fila), detalle: fuente.detalle(fila),
    }));
    return { titulo: fuente.titulo, resultados, fallo: false };
  } catch {
    return { titulo: fuente.titulo, resultados: [], fallo: true };
  }
}

function useBusqueda(consulta: string, permisos: string[]) {
  const clave = FUENTES.filter(({ permiso }) => permisos.includes(permiso)).map((fuente) => fuente.clave).join(",");
  const [respuesta, establecerRespuesta] = useState({ consulta: "", clave: "", grupos: [] as Grupo[] });
  useEffect(() => {
    if (consulta.length < 2) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      const grupos = await Promise.all(FUENTES.filter((fuente) => clave.split(",").includes(fuente.clave))
        .map((fuente) => buscarGrupo(fuente, consulta, controlador.signal)));
      if (!controlador.signal.aborted) establecerRespuesta({ consulta, clave, grupos });
    }, 250);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [consulta, clave]);
  const cargando = consulta.length >= 2 && (respuesta.consulta !== consulta || respuesta.clave !== clave);
  return { cargando, grupos: consulta.length < 2 || cargando ? [] : respuesta.grupos };
}

function EstadoBusqueda({ consulta, cargando, grupos, hayAccesos }: { consulta: string; cargando: boolean; grupos: Grupo[]; hayAccesos: boolean }) {
  if (consulta.length < 2) return null;
  if (cargando) return (
    <div role="status" className="space-y-2 px-3 pb-3">
      <span className="sr-only">Buscando</span>
      {[0, 1, 2].map((indice) => <Skeleton key={indice} className="h-11 rounded-lg bg-slate-100 motion-reduce:animate-none" aria-hidden="true" />)}
    </div>
  );
  if (grupos.some(({ fallo }) => fallo)) return <p role="status" className="px-5 pb-3 text-sm text-slate-500">No se pudieron consultar algunos módulos.</p>;
  if (!hayAccesos && grupos.every(({ resultados }) => resultados.length === 0)) return (
    <div role="status" className="px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-900">Sin resultados para «{consulta}»</p>
      <p className="mt-1 text-sm text-slate-500">Pruebe con el código, el nombre del cliente o el RUC.</p>
    </div>
  );
  return null;
}

function FilaResultado({ fila, id, activo, seleccionar, cerrar }: { fila: Resultado; id: string; activo: boolean; seleccionar: (id: string) => void; cerrar: () => void }) {
  const Icono = fila.icono;
  return (
    <Link id={id} href={fila.destino} role="option" aria-selected={activo} tabIndex={-1} prefetch={false} onClick={cerrar}
      onMouseEnter={() => seleccionar(id)}
      className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-100", activo ? "bg-slate-100" : "hover:bg-slate-50")}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600">
        <Icono aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{fila.titulo}</span>
      {fila.detalle ? <span className="shrink-0 text-xs text-slate-500">{fila.detalle}</span> : null}
      <CornerDownLeft aria-hidden="true" className={cn("size-3.5 shrink-0 text-slate-400", !activo && "invisible")} />
    </Link>
  );
}

function ListaResultados(entrada: { grupos: Grupo[]; listaId: string; activo?: string; seleccionar: (id: string) => void; cerrar: () => void }) {
  const { grupos, listaId, activo, seleccionar, cerrar } = entrada;
  return (
    <div id={listaId} role="listbox" aria-label="Resultados de búsqueda" className="max-h-[55vh] overflow-y-auto px-2 pb-2">
      {grupos.filter(({ resultados }) => resultados.length > 0).map(({ titulo, resultados }, indice) => (
        <div key={titulo} role="group" aria-labelledby={`${listaId}-grupo-${indice}`}>
          <h3 id={`${listaId}-grupo-${indice}`} className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-500">{titulo}</h3>
          {resultados.map((fila) => {
            const id = `${listaId}-${fila.id}`;
            return <FilaResultado key={fila.id} fila={fila} id={id} activo={activo === id} seleccionar={seleccionar} cerrar={cerrar} />;
          })}
        </div>
      ))}
    </div>
  );
}

function useSeleccion(entrada: { filas: Resultado[]; listaId: string; cerrar: () => void }) {
  const { filas, listaId, cerrar } = entrada;
  const router = useRouter();
  const [seleccion, seleccionar] = useState(0);
  const indice = Math.min(seleccion, Math.max(0, filas.length - 1));
  const fila = filas[indice];
  const activo = fila ? `${listaId}-${fila.id}` : undefined;
  useEffect(() => { if (activo) document.getElementById(activo)?.scrollIntoView({ block: "nearest" }); }, [activo]);
  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing || filas.length === 0) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      seleccionar((indice + (evento.key === "ArrowDown" ? 1 : filas.length - 1)) % filas.length);
    }
    if (evento.key === "Enter" && fila) {
      evento.preventDefault();
      router.push(fila.destino);
      cerrar();
    }
  }
  return { activo, manejarTecla, reiniciar: () => seleccionar(0),
    seleccionar: (id: string) => seleccionar(filas.findIndex((candidata) => `${listaId}-${candidata.id}` === id)) };
}

const Tecla = ({ children }: { children: string }) => <kbd className="rounded border border-slate-200 bg-card px-1.5 text-[11px] text-slate-600">{children}</kbd>;

// Pistas de teclado solo con mouse y teclado (en táctil no aplican).
function PieTeclado() {
  return (
    <div aria-hidden="true" className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500 [@media(pointer:fine)]:flex">
      <span className="flex items-center gap-1.5"><Tecla>↑</Tecla><Tecla>↓</Tecla>navegar</span>
      <span className="flex items-center gap-1.5"><Tecla>Enter</Tecla>abrir</span>
      <span className="flex items-center gap-1.5"><Tecla>Esc</Tecla>cerrar</span>
    </div>
  );
}

function ContenidoBusqueda({ permisos, cerrar }: { permisos: string[]; cerrar: () => void }) {
  const [texto, establecerTexto] = useState("");
  const consulta = texto.trim();
  const listaId = useId();
  const { cargando, grupos: remotos } = useBusqueda(consulta, permisos);
  const atajos = accesos(permisos, consulta);
  const grupos: Grupo[] = [...remotos, { titulo: consulta ? "Secciones y acciones" : "Ir a", resultados: atajos, fallo: false }];
  const filas = grupos.flatMap(({ resultados }) => resultados);
  const seleccion = useSeleccion({ filas, listaId, cerrar });
  return (
    <>
      <DialogTitle className="sr-only">Buscar en TRACORE</DialogTitle>
      <DialogDescription className="sr-only">Busque clientes, cotizaciones y órdenes por código o nombre, o vaya a una sección.</DialogDescription>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4">
        <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input value={texto} onChange={(evento) => { establecerTexto(evento.target.value); seleccion.reiniciar(); }}
          onKeyDown={seleccion.manejarTecla} placeholder={marcadorBusqueda(permisos)} aria-label="Buscar en TRACORE"
          role="combobox" aria-expanded="true" aria-controls={listaId} aria-autocomplete="list"
          aria-activedescendant={seleccion.activo} autoComplete="off" maxLength={200}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" />
        <DialogClose className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-ring">
          <X aria-hidden="true" className="size-4" /><span className="sr-only">Cerrar</span>
        </DialogClose>
      </div>
      <EstadoBusqueda consulta={consulta} cargando={cargando} grupos={remotos} hayAccesos={atajos.length > 0} />
      <ListaResultados grupos={grupos} listaId={listaId} activo={seleccion.activo} seleccionar={seleccion.seleccionar} cerrar={cerrar} />
      {filas.length > 0 && <p role="status" className="sr-only">{filas.length} resultados</p>}
      <PieTeclado />
    </>
  );
}

// atajo: solo una instancia visible escucha Ctrl+K (el menú puede montar la versión de riel y la ancha a la vez).
export function BuscadorGlobal({ permisos, modo, atajo = true }: Propiedades & { atajo?: boolean }) {
  const [abierto, establecerAbierto] = useState(false);
  useEffect(() => {
    if (!atajo) return;
    function abrirConTeclado(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        establecerAbierto(true);
      }
    }
    window.addEventListener("keydown", abrirConTeclado);
    return () => window.removeEventListener("keydown", abrirConTeclado);
  }, [atajo]);
  return (
    <Dialog open={abierto} onOpenChange={establecerAbierto}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Buscar en TRACORE" title="Buscar"
          className={`flex items-center rounded-xl border border-slate-200 bg-card text-sm text-slate-600 shadow-xs transition-colors duration-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring ${modo === "amplio" ? "h-10 w-full gap-2 px-3" : "size-10 justify-center"}`}>
          <Search className="size-4" aria-hidden="true" />
          {modo === "amplio" && <><span>Buscar</span><kbd aria-hidden="true" className="ml-auto hidden rounded-md border border-slate-200 bg-card px-1.5 text-[11px] text-slate-500 [@media(pointer:fine)]:inline">Ctrl K</kbd></>}
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}
        className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-xl motion-reduce:animate-none">
        <ContenidoBusqueda permisos={permisos} cerrar={() => establecerAbierto(false)} />
      </DialogContent>
    </Dialog>
  );
}
