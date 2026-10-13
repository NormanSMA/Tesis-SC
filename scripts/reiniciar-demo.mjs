#!/usr/bin/env node
// Devuelve la base de demostración al estado de la siembra. Úsalo tras correr E2E o rendimiento contra la aplicación:
// esas pruebas crean clientes, cotizaciones y órdenes reales en la base (por ejemplo RENDIMIENTO-...).
// No borra el volumen de respaldos. Uso: pnpm demo:reiniciar
import { spawnSync } from "node:child_process";

function ejecutar(comando, argumentos) {
  console.log(`> ${comando} ${argumentos.join(" ")}`);
  const resultado = spawnSync(comando, argumentos, { stdio: "inherit", shell: process.platform === "win32" });
  if (resultado.status !== 0) {
    console.error(`Falló: ${comando} ${argumentos.join(" ")}`);
    process.exit(resultado.status ?? 1);
  }
}

ejecutar("docker", ["compose", "rm", "-sfv", "app", "migrate", "db"]);
const volumen = spawnSync("docker", ["volume", "rm", "sc-plataforma_sc_pgdata"], { stdio: "inherit", shell: process.platform === "win32" });
if (volumen.status !== 0) console.warn("No se pudo borrar el volumen de datos; revise si el nombre cambió (docker volume ls).");
ejecutar("docker", ["compose", "up", "-d", "--build", "app"]);
console.log("Base de demostración reiniciada con la siembra limpia.");
