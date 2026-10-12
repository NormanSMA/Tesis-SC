// Cifrado de respaldos con AES-256-GCM. La clave se deriva de una frase con scrypt.
// Formato del archivo: "SCRESP1" (7 bytes) | sal (16) | iv (12) | texto cifrado | etiqueta GCM (16).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MARCA = Buffer.from("SCRESP1");
const LONGITUD_SAL = 16;
const LONGITUD_IV = 12;
const LONGITUD_ETIQUETA = 16;
export const LONGITUD_MINIMA_CLAVE = 14;

function derivarClave(frase, sal) {
  return scryptSync(frase, sal, 32);
}

function exigirFrase(frase) {
  if (typeof frase !== "string" || frase.length < LONGITUD_MINIMA_CLAVE) {
    throw new Error(`La clave de respaldo exige al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`);
  }
}

/** @param {Buffer} contenido @param {string} frase @returns {Buffer} */
export function cifrar(contenido, frase) {
  exigirFrase(frase);
  const sal = randomBytes(LONGITUD_SAL);
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv("aes-256-gcm", derivarClave(frase, sal), iv);
  const cifrado = Buffer.concat([cifrador.update(contenido), cifrador.final()]);
  return Buffer.concat([MARCA, sal, iv, cifrado, cifrador.getAuthTag()]);
}

/** @param {Buffer} archivo @param {string} frase @returns {Buffer} */
export function descifrar(archivo, frase) {
  exigirFrase(frase);
  const minimo = MARCA.length + LONGITUD_SAL + LONGITUD_IV + LONGITUD_ETIQUETA;
  if (archivo.length < minimo || !archivo.subarray(0, MARCA.length).equals(MARCA)) {
    throw new Error("El archivo no es un respaldo cifrado de SC Plataforma.");
  }
  const sal = archivo.subarray(MARCA.length, MARCA.length + LONGITUD_SAL);
  const iv = archivo.subarray(MARCA.length + LONGITUD_SAL, MARCA.length + LONGITUD_SAL + LONGITUD_IV);
  const etiqueta = archivo.subarray(archivo.length - LONGITUD_ETIQUETA);
  const cifrado = archivo.subarray(MARCA.length + LONGITUD_SAL + LONGITUD_IV, archivo.length - LONGITUD_ETIQUETA);
  const descifrador = createDecipheriv("aes-256-gcm", derivarClave(frase, sal), iv);
  descifrador.setAuthTag(etiqueta);
  try {
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
  } catch {
    throw new Error("No se pudo descifrar: clave incorrecta o archivo alterado.");
  }
}
