// Defensa global: ninguna prueba debe tocar la base de desarrollo o demostración.
// src/lib/db.ts toma DATABASE_URL al importarse; aquí se apunta a la base de pruebas antes de cualquier import.
import { urlApp } from "./entorno-bd";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = urlApp();
}
