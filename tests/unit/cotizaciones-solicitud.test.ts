import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { solicitarApi } from "@/lib/cliente-api";
import { useSolicitudCotizacion } from "@/modules/cotizaciones/useSolicitudCotizacion";

const dobles = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => dobles }));
vi.mock("sonner", () => ({ toast: dobles }));
vi.mock("@/lib/cliente-api", () => ({ solicitarApi: vi.fn() }));

function capturar(alGuardar?: (id: string, numero?: string) => void) {
  let solicitud: ReturnType<typeof useSolicitudCotizacion> | undefined;
  function Captura() { solicitud = useSolicitudCotizacion(undefined, alGuardar); return null; }
  renderToStaticMarkup(createElement(Captura));
  return solicitud!;
}

const peticion = { url: "/api/v1/cotizaciones", metodo: "POST", cuerpo: { asunto: "Trabajo" }, destino: "editar" } as const;
beforeEach(() => vi.clearAllMocks());

describe("guardado de cotizaciones en página y drawer", () => {
  it("entrega el id y el número sin navegar ni refrescar al usar callback", async () => {
    vi.mocked(solicitarApi).mockResolvedValue({ datos: { id: "cotizacion", numero: "COT-2026-0001" } });
    const alGuardar = vi.fn();
    await capturar(alGuardar).enviar(peticion);
    expect(alGuardar).toHaveBeenCalledWith("cotizacion", "COT-2026-0001");
    expect(dobles.push).not.toHaveBeenCalled();
    expect(dobles.refresh).not.toHaveBeenCalled();
    expect(dobles.success).not.toHaveBeenCalled();
  });

  it("conserva la navegación de la página y muestra los avisos", async () => {
    vi.mocked(solicitarApi).mockResolvedValue({ datos: { id: "cotizacion", avisos: ["Revise el margen."] } });
    await capturar().enviar(peticion);
    expect(dobles.push).toHaveBeenCalledWith("/cotizaciones/cotizacion/editar");
    expect(dobles.refresh).toHaveBeenCalledOnce();
    expect(dobles.success).toHaveBeenCalledWith("Cotización guardada.");
    expect(dobles.warning).toHaveBeenCalledWith("Revise el margen.");
  });

  it("conserva el formulario ante errores sin ejecutar el callback", async () => {
    vi.mocked(solicitarApi).mockResolvedValue({ error: { mensaje: "Revise los campos.", campos: { asunto: "Es obligatorio." } } });
    const alGuardar = vi.fn();
    await capturar(alGuardar).enviar(peticion);
    expect(alGuardar).not.toHaveBeenCalled();
    expect(dobles.push).not.toHaveBeenCalled();
    expect(dobles.refresh).not.toHaveBeenCalled();
  });

  it("bloquea el doble envío mientras la petición sigue pendiente", async () => {
    let resolver!: (valor: { datos: { id: string } }) => void;
    vi.mocked(solicitarApi).mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const solicitud = capturar(vi.fn());
    const primero = solicitud.enviar(peticion);
    await solicitud.enviar(peticion);
    expect(solicitarApi).toHaveBeenCalledOnce();
    resolver({ datos: { id: "cotizacion" } });
    await primero;
  });
});
