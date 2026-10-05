// Sin imports de Prisma ni de vitest: lo usa global-setup, que corre antes de generar el cliente.

function exigir(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Revisa .env.example.`);
  return valor;
}

export function urlPropietario(): string {
  return exigir("TEST_DATABASE_URL");
}

export function urlApp(): string {
  const url = new URL(urlPropietario());
  url.username = process.env.APP_DB_USER ?? "sc_app";
  url.password = exigir("APP_DB_PASSWORD");
  return url.toString();
}

// node-postgres no conoce el parametro schema que Prisma acepta en la URL.
export function urlParaPg(url: string): string {
  const limpia = new URL(url);
  limpia.searchParams.delete("schema");
  return limpia.toString();
}

export function nombreBaseDeDatos(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
