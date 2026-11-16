import { describe, expect, it } from "vitest";
import { leerCoordenadas } from "@/modules/cotizaciones/coordenadas";
import { datosInstalacion, kilometrosCobrados, costoInstalacion } from "@/modules/cotizaciones/instalacion";

describe("cotizaciones: ubicación y traslado único", () => {
  it.each([
    "13.30, -86.49", "13.30; -86.49",
    "https://www.google.com/maps/search/?api=1&query=13.30%2C-86.49",
    "https://maps.apple.com/?ll=13.30,-86.49",
    "https://www.bing.com/maps?cp=13.30~-86.49",
    "https://www.openstreetmap.org/#map=14/13.30/-86.49",
    "https://www.google.com/maps/@13.30,-86.49,15z",
    "https://www.google.com/maps/@12,-85,15z/data=!3d13.30!4d-86.49",
  ])("extrae el destino de %s", texto => expect(leerCoordenadas(texto)).toEqual([13.3,-86.49]));
  it.each(["91,-86", "13,181", "13.3,", "https://maps.app.goo.gl/corto", "javascript:13,-86", "https://mapa.test?q=Estelí", "https://mapa.test/%ZZ"])("rechaza coordenadas incompletas o inválidas: %s", t => expect(leerCoordenadas(t)).toBeNull());
  it("calcula ida y vuelta y permite una tarifa de excepción, incluido cero", () => {
    const entrada = { manoObra: "100", km: "10.125", destino: "13.30,-86.49", idaVuelta: true, tarifa: "12" };
    const datos = datosInstalacion(entrada,{ tipoCambio:"1",tarifaNio:"16" });
    expect(datos).toMatchObject({instalacionKm:"10.125", instalacionIdaVuelta:true, instalacionTarifa:"12", instalacionTotal:"343.00"});
    expect(kilometrosCobrados("10.125",true)).toBe("20.250");
    expect(datosInstalacion({...entrada,tarifa:"0"},{tipoCambio:"1",tarifaNio:"16"}).instalacionTotal).toBe("100.00");
    expect(costoInstalacion("100","10","16")).toBe("260.00");
  });
});
