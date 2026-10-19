// Siembra masiva de la base sc_carga (nunca sc_plataforma) y fixtures de concurrencia.
// Uso: node scripts/carga/sembrar-masivo.mjs [--solo-fixtures] [--rondas N]
//   Sin opciones: siembra el volumen completo si falta y crea fixtures nuevos de concurrencia.
//   --solo-fixtures: no siembra volumen; exige que ya exista.
// Escribe scripts/carga/sesiones.json, concurrencia.json y estado.json (ignorados por git).
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { hash } from "@node-rs/argon2";

import { ARCHIVO_CONCURRENCIA, ARCHIVO_ESTADO, ARCHIVO_SESIONES, conectar, leerEntorno, leerOpciones } from "./comun.mjs";

const VOLUMEN = { usuarios: 1000, clientes: 2000, materiales: 300, cotizaciones: 20000, ordenes: 1000, movimientos: 20000 };
const PERFILES = [ // 1000 usuarios en los 6 perfiles
  ["GERENCIA", 100], ["ATENCION_CLIENTE", 250], ["PRODUCCION", 200], ["ADMIN", 50], ["ADMINISTRACION", 150], ["OPERACIONES", 250],
];
const CORREO_PRIMERO = "carga0001@carga.local";
const SESION_HORAS = 24;
const FIXTURES = { rondas: 6, ordenesConsumo: 5, existenciaDisputa: "100.000", consumoPorVu: "3.000", clientesResistencia: 200 };

const log = (texto) => process.stdout.write(`${texto}\n`);

async function sembrarBasicos(c) {
  const claveHash = await hash(randomBytes(24).toString("base64url"), { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await c.query(`
    INSERT INTO usuario (id, nombre, correo, hash_contrasena, activo, creado_en, actualizado_en)
    SELECT gen_random_uuid(), 'Usuario carga ' || n, 'carga' || lpad(n::text, 4, '0') || '@carga.local', $1, true, now(), now()
    FROM generate_series(1, $2::int) n`, [claveHash, VOLUMEN.usuarios]);
  let desde = 1;
  for (const [codigo, cantidad] of PERFILES) {
    await c.query(`
      INSERT INTO usuario_perfil (usuario_id, perfil_id)
      SELECT u.id, (SELECT id FROM perfil WHERE codigo = $1::codigo_perfil)
      FROM usuario u WHERE u.correo IN (SELECT 'carga' || lpad(n::text, 4, '0') || '@carga.local' FROM generate_series($2::int, $3::int) n)`,
    [codigo, desde, desde + cantidad - 1]);
    desde += cantidad;
  }
  await c.query(`
    INSERT INTO cliente (id, nombre, tipo, ruc, contacto_principal, telefono, correo, direccion, activo, creado_en, actualizado_en)
    SELECT gen_random_uuid(),
      (ARRAY['Rotulos','Publicidad','Imprenta','Constructora','Ferreteria','Hotel','Restaurante','Clinica','Escuela','Cooperativa'])[1 + n % 10]
        || ' ' || (ARRAY['Los Pinos','El Norte','San Juan','La Ceiba','Central','Del Valle','Las Flores','Nueva Era','Horizonte','Estelí'])[1 + (n / 10) % 10] || ' ' || n,
      (CASE WHEN n % 3 = 0 THEN 'PERSONA' ELSE 'EMPRESA' END)::tipo_cliente,
      'CG' || lpad(n::text, 10, '0'), 'Contacto ' || n, '+505 8' || lpad((n * 37 % 1000000)::text, 6, '0'),
      'cliente' || n || '@carga.test', 'Barrio ' || (n % 40) || ', Estelí', true,
      now() - (n % 700) * interval '1 day', date_trunc('milliseconds', now())
    FROM generate_series(1, $1::int) n`, [VOLUMEN.clientes]);
  await c.query(`
    INSERT INTO material (id, codigo, nombre, unidad, existencia, costo_promedio, stock_minimo, activo, creado_en, actualizado_en)
    SELECT gen_random_uuid(), 'CARGA-M' || lpad(n::text, 4, '0'),
      (ARRAY['Vinil','Lona','Acrilico','Tinta','Madera MDF','Aluminio','Tornillo','Pintura','Cinta','Lamina'])[1 + n % 10] || ' ' || n,
      (ARRAY['UNIDAD','METRO','M2','YARDA','PIE','LITRO','GALON','KILOGRAMO','LIBRA','PLIEGO','ROLLO'])[1 + n % 11]::unidad_material,
      0, 0, 20 + n % 80, true, now(), now()
    FROM generate_series(1, $1::int) n`, [VOLUMEN.materiales]);
}

// Numeracion: continua despues del mayor numero existente por anio y deja el contador al dia.
const SQL_NUMERAR = (tabla, tipoDoc, prefijo, alias, columnaFecha) => `
  CREATE TEMP TABLE t_base_${tabla} ON COMMIT DROP AS
  SELECT a.anio, greatest(
      coalesce((SELECT ultimo FROM contador WHERE tipo = '${tipoDoc}' AND anio = a.anio), 0),
      coalesce((SELECT max(substring(numero from '[0-9]+$')::int) FROM ${tabla} WHERE numero LIKE '${prefijo}-' || a.anio || '-%'), 0)) AS base
  FROM (SELECT DISTINCT extract(year FROM ${columnaFecha} AT TIME ZONE 'America/Managua')::int AS anio FROM ${alias}) a;
  UPDATE ${alias} t SET numero = '${prefijo}-' || s.anio || '-' || lpad(s.seq::text, greatest(4, length(s.seq::text)), '0')
  FROM (SELECT x.id, y.anio, row_number() OVER (PARTITION BY y.anio ORDER BY x.${columnaFecha}, x.id) + y.base AS seq
        FROM ${alias} x JOIN t_base_${tabla} y ON y.anio = extract(year FROM x.${columnaFecha} AT TIME ZONE 'America/Managua')::int) s
  WHERE s.id = t.id;
  INSERT INTO contador (tipo, anio, ultimo)
  SELECT '${tipoDoc}'::tipo_documento, anio, max(substring(numero from '[0-9]+$')::int)
  FROM ${alias} t JOIN t_base_${tabla} b ON b.anio = extract(year FROM t.${columnaFecha} AT TIME ZONE 'America/Managua')::int
  GROUP BY anio
  ON CONFLICT (tipo, anio) DO UPDATE SET ultimo = greatest(contador.ultimo, EXCLUDED.ultimo);`;

async function sembrarDocumentos(c) {
  // Las maquinas de estado y el congelado de la cotizacion se saltan solo en esta carga historica.
  // Los CHECK y las claves unicas siguen activos. Los datos se arman ya coherentes.
  await c.query("SET LOCAL session_replication_role = replica");
  await c.query("SELECT setseed(0.42)");
  await c.query(`CREATE TEMP TABLE t_cli ON COMMIT DROP AS SELECT row_number() OVER (ORDER BY id) AS rn, id FROM cliente WHERE activo`);
  await c.query(`CREATE TEMP TABLE t_prod ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY codigo) AS rn, id, categoria_id, unidad_cobro, precio_base, nombre
    FROM producto WHERE activo AND categoria_id IN (SELECT categoria_id FROM etapa_plantilla WHERE activo)`);
  const usuariosDe = (codigo) => c.query(`CREATE TEMP TABLE t_u_${codigo.toLowerCase()} ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY u.correo) AS rn, u.id FROM usuario u
    JOIN usuario_perfil up ON up.usuario_id = u.id JOIN perfil p ON p.id = up.perfil_id
    WHERE p.codigo = '${codigo}' AND u.correo LIKE 'carga%@carga.local'`);
  for (const codigo of ["ATENCION_CLIENTE", "OPERACIONES", "PRODUCCION"]) await usuariosDe(codigo);
  const cuenta = async (tabla) => Number((await c.query(`SELECT count(*)::int AS n FROM ${tabla}`)).rows[0].n);
  const [nCli, nProd, nAtc, nOp, nPro] = [await cuenta("t_cli"), await cuenta("t_prod"), await cuenta("t_u_atencion_cliente"),
    await cuenta("t_u_operaciones"), await cuenta("t_u_produccion")];

  await c.query(`
    CREATE TEMP TABLE t_cot ON COMMIT DROP AS
    WITH est AS (
      SELECT n, CASE WHEN r < 15 THEN 'BORRADOR' WHEN r < 35 THEN 'ENVIADA' WHEN r < 60 THEN 'APROBADA'
        WHEN r < 72 THEN 'RECHAZADA' WHEN r < 85 THEN 'VENCIDA' ELSE 'AJUSTE_SOLICITADO' END::estado_cotizacion AS estado
      FROM (SELECT n, (n * 7919) % 100 AS r FROM generate_series(1, $1::int) n) b),
    fec AS (
      SELECT n, estado, now() - (CASE estado WHEN 'VENCIDA' THEN 60 + random() * 480 WHEN 'ENVIADA' THEN random() * 40 ELSE random() * 540 END)
        * interval '1 day' AS creado FROM est),
    cal AS (
      SELECT f.n, f.estado, f.creado, c.id AS cliente_id, p.id AS producto_id, p.categoria_id, p.unidad_cobro, p.precio_base, p.nombre AS producto,
        (1 + f.n % 9)::numeric AS cantidad,
        CASE WHEN p.unidad_cobro = 'M2' THEN (1 + f.n % 4) * 0.5 END AS ancho,
        CASE WHEN p.unidad_cobro = 'M2' THEN (1 + f.n % 3) * 0.75 END AS alto,
        (ARRAY[15, 30])[1 + f.n % 2] AS vigencia, a.id AS creador, o.id AS aprobador
      FROM fec f
      JOIN t_cli c ON c.rn = 1 + (f.n * 31) % $2::int
      JOIN t_prod p ON p.rn = 1 + (f.n * 17) % $3::int
      JOIN t_u_atencion_cliente a ON a.rn = 1 + f.n % $4::int
      JOIN t_u_operaciones o ON o.rn = 1 + f.n % $5::int)
    SELECT cal.*, gen_random_uuid() AS id, NULL::text AS numero,
      round(CASE WHEN unidad_cobro = 'M2' THEN precio_base * ancho * alto * cantidad ELSE precio_base * cantidad END, 2) AS importe
    FROM cal`, [VOLUMEN.cotizaciones, nCli, nProd, nAtc, nOp]);
  await c.query(SQL_NUMERAR("cotizacion", "COTIZACION", "COT", "t_cot", "creado"));
  await c.query(`
    INSERT INTO cotizacion (id, numero, cliente_id, estado, asunto, condiciones, moneda, tipo_cambio, tasa_impuesto, subtotal, descuento,
      impuesto, total, vigencia_dias, fecha_emision, fecha_vencimiento, fecha_respuesta, motivo_rechazo, usuario_aprobacion_id,
      referencia_aprobacion, motivo_ajuste, version, archivada, creado_por_id, creado_en, actualizado_en)
    SELECT id, numero, cliente_id, estado,
      (ARRAY['Rotulo luminoso','Banner de lona','Letras corporeas','Vinilo para vehiculo','Caja de luz','Stand de feria',
        'Impresion gran formato','Senalizacion interior','Uniformes bordados','Llaveros promocionales'])[1 + n % 10] || ' ' || (n % 500),
      'Pago 50 % al aprobar y 50 % al entregar.', 'NIO', 1, 15, importe, 0, round(importe * 15 / 100, 2), importe + round(importe * 15 / 100, 2),
      vigencia,
      CASE WHEN estado <> 'BORRADOR' THEN (creado AT TIME ZONE 'America/Managua')::date END,
      CASE WHEN estado <> 'BORRADOR' THEN (creado AT TIME ZONE 'America/Managua')::date + vigencia END,
      CASE WHEN estado IN ('APROBADA', 'RECHAZADA', 'AJUSTE_SOLICITADO') THEN least(creado + interval '3 days', now()) END,
      CASE WHEN estado = 'RECHAZADA' THEN 'Precio fuera de presupuesto' END,
      CASE WHEN estado = 'APROBADA' THEN aprobador END,
      CASE WHEN estado = 'APROBADA' THEN 'OC-' || n END,
      CASE WHEN estado = 'AJUSTE_SOLICITADO' THEN 'El cliente pide ajustar medidas' END,
      1, estado IN ('RECHAZADA', 'VENCIDA') AND n % 50 = 0, creador, creado, creado
    FROM t_cot`);
  await c.query(`
    INSERT INTO item_cotizacion (id, cotizacion_id, secuencia, tipo, producto_id, categoria_id, descripcion, unidad_cobro, cantidad, ancho, alto,
      precio_unitario, importe)
    SELECT gen_random_uuid(), id, 1, 'CATALOGO', producto_id, categoria_id, producto, unidad_cobro, cantidad, ancho, alto, precio_base, importe
    FROM t_cot`);
  await c.query(`
    INSERT INTO bitacora (entidad, entidad_id, cotizacion_id, accion, estado_nuevo, usuario_id, creado_en)
    SELECT 'COTIZACION', id, id, 'CREAR', 'BORRADOR', creador, creado FROM t_cot`);

  await c.query(`
    CREATE TEMP TABLE t_ord ON COMMIT DROP AS
    SELECT x.id, x.cliente_id, x.categoria_id, x.producto, x.j, gen_random_uuid() AS oid, NULL::text AS numero,
      (CASE WHEN j <= 80 THEN 'PENDIENTE' WHEN j <= 380 THEN 'EN_PRODUCCION' WHEN j <= 530 THEN 'LISTA' WHEN j <= 680 THEN 'ENTREGADA'
        WHEN j <= 950 THEN 'CERRADA' ELSE 'CANCELADA' END)::estado_orden AS oestado,
      least(x.creado + interval '4 days', now()) AS ocreado,
      pr.id AS responsable_prod, op.id AS creador_orden
    FROM (SELECT t.id, t.cliente_id, t.categoria_id, t.producto, t.creado, row_number() OVER (ORDER BY t.creado DESC) AS j
          FROM t_cot t WHERE t.estado = 'APROBADA') x
    JOIN t_u_produccion pr ON pr.rn = 1 + x.j % $2::int
    JOIN t_u_operaciones op ON op.rn = 1 + x.j % $3::int
    WHERE x.j <= $1::int`, [VOLUMEN.ordenes, nPro, nOp]);
  await c.query(SQL_NUMERAR("orden_trabajo", "ORDEN_TRABAJO", "OT", "t_ord", "ocreado"));
  await c.query(`
    INSERT INTO orden_trabajo (id, numero, cotizacion_id, categoria_id, estado, responsable_id, cliente_id, especificaciones, fecha_entrega,
      fecha_inicio_real, fecha_entrega_real, fecha_cierre, motivo_cancelacion, creado_por_id, creado_en, actualizado_en)
    SELECT oid, numero, id, categoria_id, oestado,
      CASE WHEN oestado = 'PENDIENTE' AND j % 4 = 0 THEN NULL ELSE responsable_prod END,
      cliente_id, producto, (ocreado AT TIME ZONE 'America/Managua')::date + 7 + (j % 20)::int,
      CASE WHEN oestado IN ('EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA') THEN least(ocreado + interval '1 day', now()) END,
      CASE WHEN oestado IN ('ENTREGADA', 'CERRADA') THEN least(ocreado + interval '4 days', now()) END,
      CASE WHEN oestado = 'CERRADA' THEN least(ocreado + interval '5 days', now()) END,
      CASE WHEN oestado = 'CANCELADA' THEN 'Cancelada por el cliente' END,
      creador_orden, ocreado, ocreado
    FROM t_ord`);
  await c.query(`
    INSERT INTO etapa_orden (id, orden_id, plantilla_id, area_id, secuencia, nombre, estado, responsable_id, fecha_inicio_real, fecha_fin_real,
      creado_en, actualizado_en)
    SELECT gen_random_uuid(), q.oid, q.pid, q.area_id, q.secuencia, q.nombre, q.estado::estado_etapa,
      CASE WHEN q.estado <> 'PENDIENTE' THEN q.responsable_prod END,
      CASE WHEN q.estado <> 'PENDIENTE' THEN least(q.ocreado + interval '1 day', now()) END,
      CASE WHEN q.estado = 'COMPLETADA' THEN least(q.ocreado + interval '1 day' + q.rk * interval '1 hour', now()) END,
      q.ocreado, q.ocreado
    FROM (SELECT o.oid, o.ocreado, o.responsable_prod, p.id AS pid, p.area_id, p.secuencia, p.nombre,
        row_number() OVER (PARTITION BY o.oid ORDER BY p.secuencia) AS rk, count(*) OVER (PARTITION BY o.oid) AS total,
        o.oestado, o.j
      FROM t_ord o JOIN etapa_plantilla p ON p.categoria_id = o.categoria_id AND p.activo) b
    CROSS JOIN LATERAL (SELECT b.oid, b.ocreado, b.responsable_prod, b.pid, b.area_id, b.secuencia, b.nombre, b.rk,
      CASE WHEN b.oestado IN ('PENDIENTE', 'CANCELADA') THEN 'PENDIENTE'
        WHEN b.oestado = 'EN_PRODUCCION' THEN CASE WHEN b.rk < 1 + b.j % b.total THEN 'COMPLETADA'
          WHEN b.rk = 1 + b.j % b.total THEN 'EN_CURSO' ELSE 'PENDIENTE' END
        ELSE 'COMPLETADA' END AS estado) q`);
  await c.query(`
    INSERT INTO bitacora (entidad, entidad_id, orden_id, cotizacion_id, accion, estado_nuevo, usuario_id, creado_en)
    SELECT 'ORDEN_TRABAJO', oid, oid, id, 'CONVERTIR_EN_ORDEN', 'PENDIENTE', creador_orden, ocreado FROM t_ord`);
  await c.query("RESET session_replication_role");
}

// Simula el libro en memoria (milesimas enteras) y lo inserta en orden cronologico con los triggers activos.
async function sembrarMovimientos(c) {
  const materiales = (await c.query("SELECT id FROM material WHERE codigo LIKE 'CARGA-M%' ORDER BY codigo")).rows.map((r) => r.id);
  const ordenes = (await c.query(`SELECT o.id FROM orden_trabajo o JOIN cotizacion q ON q.id = o.cotizacion_id
    WHERE o.estado IN ('EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA') AND q.referencia_aprobacion LIKE 'OC-%'`)).rows.map((r) => r.id);
  const usuarios = (await c.query(`SELECT u.id FROM usuario u JOIN usuario_perfil up ON up.usuario_id = u.id
    JOIN perfil p ON p.id = up.perfil_id WHERE p.codigo = 'ADMINISTRACION' AND u.correo LIKE 'carga%@carga.local' ORDER BY u.correo`)).rows.map((r) => r.id);
  const saldo = new Map(); // material -> milesimas
  const neto = new Map(); // "orden|material" -> milesimas consumidas netas
  const devolvibles = [];
  const enLista = new Set();
  const aleatorio = (max) => Math.floor(Math.random() * max);
  const fin = Date.now() - 2 * 3600_000;
  const inicio = fin - 400 * 86400_000;
  const paso = (fin - inicio) / VOLUMEN.movimientos;
  const filas = [];
  const texto = (milesimas) => (milesimas / 1000).toFixed(3);
  for (let i = 0; i < VOLUMEN.movimientos; i++) {
    const fila = { id: randomUUID(), usuario: usuarios[aleatorio(usuarios.length)], creado: new Date(inicio + i * paso).toISOString(), motivo: null, orden: null };
    const r = Math.random();
    if (i < materiales.length || r < 0.2) {
      const material = i < materiales.length ? materiales[i] : materiales[aleatorio(materiales.length)];
      const cantidad = (i < materiales.length ? 200_000 + aleatorio(800_000) : 50_000 + aleatorio(450_000));
      Object.assign(fila, { material, tipo: "ENTRADA", cantidad, costo: (5 + Math.random() * 195).toFixed(4) });
    } else if (r < 0.28) {
      const material = materiales[aleatorio(materiales.length)];
      const disponible = saldo.get(material) ?? 0;
      const baja = disponible > 20_000 && Math.random() < 0.5;
      Object.assign(fila, { material, tipo: "AJUSTE", cantidad: baja ? -(1_000 + aleatorio(15_000)) : 1_000 + aleatorio(15_000), costo: "0", motivo: "Conteo fisico" });
    } else if (r < 0.38 && devolvibles.length) {
      const indice = aleatorio(devolvibles.length);
      const [orden, material] = devolvibles[indice].split("|");
      const disponible = neto.get(devolvibles[indice]);
      const cantidad = Math.max(1, Math.min(disponible, 1_000 + aleatorio(disponible)));
      Object.assign(fila, { material, orden, tipo: "DEVOLUCION", cantidad, costo: "0" });
      if (disponible - cantidad <= 0) { devolvibles.splice(indice, 1); enLista.delete(`${orden}|${material}`); }
    } else {
      let material = materiales[aleatorio(materiales.length)];
      for (let intento = 0; intento < 10 && (saldo.get(material) ?? 0) < 30_000; intento++) material = materiales[aleatorio(materiales.length)];
      const tope = Math.min(20_000, Math.floor((saldo.get(material) ?? 0) * 0.2));
      if (tope < 1_000) { i--; continue; }
      const orden = ordenes[aleatorio(ordenes.length)];
      Object.assign(fila, { material, orden, tipo: "CONSUMO", cantidad: -(1_000 + aleatorio(tope - 999)), costo: "0" });
    }
    saldo.set(fila.material, (saldo.get(fila.material) ?? 0) + fila.cantidad);
    if (fila.orden) {
      const clave = `${fila.orden}|${fila.material}`;
      const total = (neto.get(clave) ?? 0) - fila.cantidad; // consumo suma, devolucion resta
      neto.set(clave, total);
      if (total > 0 && !enLista.has(clave)) { enLista.add(clave); devolvibles.push(clave); }
    }
    filas.push(fila);
  }
  for (let desde = 0; desde < filas.length; desde += 1000) {
    const lote = filas.slice(desde, desde + 1000);
    const col = (f) => lote.map(f);
    await c.query(`
      INSERT INTO movimiento_inventario (id, material_id, tipo, cantidad, costo_unitario, motivo, usuario_id, creado_en)
      SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::tipo_movimiento[], $4::numeric[], $5::numeric[], $6::text[], $7::uuid[], $8::timestamptz[])`,
    [col((f) => f.id), col((f) => f.material), col((f) => f.tipo), col((f) => texto(f.cantidad)), col((f) => f.costo), col((f) => f.motivo),
      col((f) => f.usuario), col((f) => f.creado)]);
    const ligados = lote.filter((f) => f.orden);
    if (!ligados.length) continue;
    await c.query(`
      INSERT INTO consumo_orden (orden_id, material_id, movimiento_id)
      SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[])`,
    [ligados.map((f) => f.orden), ligados.map((f) => f.material), ligados.map((f) => f.id)]);
    await c.query(`
      INSERT INTO bitacora (entidad, entidad_id, orden_id, accion, usuario_id, creado_en)
      SELECT 'MOVIMIENTO_INVENTARIO', t.m, t.o, t.a::accion_bitacora, t.u, t.f
      FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::uuid[], $5::timestamptz[]) AS t(m, o, a, u, f)`,
    [ligados.map((f) => f.id), ligados.map((f) => f.orden), ligados.map((f) => (f.tipo === "CONSUMO" ? "CONSUMIR_MATERIAL" : "DEVOLVER_MATERIAL")),
      ligados.map((f) => f.usuario), ligados.map((f) => f.creado)]);
  }
}

async function entradaMaterial(c, materialId, cantidad, usuario) {
  await c.query(`INSERT INTO movimiento_inventario (material_id, tipo, cantidad, costo_unitario, usuario_id) VALUES ($1, 'ENTRADA', $2, 10, $3)`,
    [materialId, cantidad, usuario]);
}

// Fixtures nuevos en cada corrida: la concurrencia consume existencias, cotizaciones aprobadas y versiones de cliente.
async function crearFixtures(c, rondas) {
  const ejecucion = randomUUID().slice(0, 8);
  const refs = (await c.query(`
    SELECT (SELECT u.id FROM usuario u JOIN usuario_perfil up ON up.usuario_id = u.id JOIN perfil p ON p.id = up.perfil_id
             WHERE p.codigo = 'OPERACIONES' AND u.correo LIKE 'carga%@carga.local' ORDER BY u.correo LIMIT 1) AS operador,
           (SELECT u.id FROM usuario u JOIN usuario_perfil up ON up.usuario_id = u.id JOIN perfil p ON p.id = up.perfil_id
             WHERE p.codigo = 'ADMINISTRACION' AND u.correo LIKE 'carga%@carga.local' ORDER BY u.correo LIMIT 1) AS almacen,
           (SELECT id FROM cliente WHERE ruc LIKE 'CG%' ORDER BY ruc LIMIT 1) AS cliente`)).rows[0];
  const producto = (await c.query(`SELECT id, categoria_id, precio_base FROM producto WHERE activo AND unidad_cobro = 'UNIDAD'
    AND categoria_id IN (SELECT categoria_id FROM etapa_plantilla WHERE activo) ORDER BY codigo LIMIT 1`)).rows[0];
  await c.query("BEGIN");
  const aprobada = async () => {
    await c.query("SET LOCAL session_replication_role = replica");
    const id = randomUUID();
    const importe = Number(producto.precio_base);
    const impuesto = Math.round(importe * 15) / 100;
    await c.query(`
      INSERT INTO cotizacion (id, numero, cliente_id, estado, asunto, moneda, tipo_cambio, tasa_impuesto, subtotal, descuento, impuesto, total,
        vigencia_dias, fecha_emision, fecha_vencimiento, fecha_respuesta, usuario_aprobacion_id, referencia_aprobacion, version, creado_por_id,
        creado_en, actualizado_en)
      VALUES ($1, siguiente_numero('COTIZACION'), $2, 'APROBADA', $3, 'NIO', 1, 15, $4, 0, $5, $6, 30, current_date, current_date + 30, now(), $7,
        'OC-FIX', 1, $7, now(), now())`, [id, refs.cliente, `Fixture concurrencia ${ejecucion}`, importe, impuesto, importe + impuesto, refs.operador]);
    await c.query(`
      INSERT INTO item_cotizacion (cotizacion_id, secuencia, tipo, producto_id, categoria_id, descripcion, unidad_cobro, cantidad, precio_unitario, importe)
      VALUES ($1, 1, 'CATALOGO', $2, $3, 'Fixture', 'UNIDAD', 1, $4, $4)`, [id, producto.id, producto.categoria_id, importe]);
    await c.query("RESET session_replication_role");
    return id;
  };
  const material = async (etiqueta, existencia) => {
    const id = randomUUID();
    await c.query(`INSERT INTO material (id, codigo, nombre, unidad, existencia, costo_promedio, stock_minimo, activo, creado_en, actualizado_en)
      VALUES ($1, $2, $3, 'UNIDAD', 0, 10, 0, true, now(), now())`, [id, `CARGA-F${ejecucion}-${etiqueta}`, `Fixture ${etiqueta} ${ejecucion}`]);
    await entradaMaterial(c, id, existencia, refs.almacen);
    return id;
  };
  const ordenes = [];
  for (let i = 0; i < FIXTURES.ordenesConsumo; i++) {
    const cotizacion = await aprobada();
    await c.query("SET LOCAL session_replication_role = replica");
    const id = randomUUID();
    await c.query(`
      INSERT INTO orden_trabajo (id, numero, cotizacion_id, categoria_id, estado, responsable_id, cliente_id, fecha_entrega, fecha_inicio_real,
        creado_por_id, creado_en, actualizado_en)
      VALUES ($1, siguiente_numero('ORDEN_TRABAJO'), $2, $3, 'EN_PRODUCCION', $4, $5, current_date + 14, now(), $4, now(), now())`,
    [id, cotizacion, producto.categoria_id, refs.operador, refs.cliente]);
    await c.query(`INSERT INTO bitacora (entidad, entidad_id, orden_id, cotizacion_id, accion, estado_nuevo, usuario_id)
      VALUES ('ORDEN_TRABAJO', $1, $1, $2, 'CONVERTIR_EN_ORDEN', 'PENDIENTE', $3)`, [id, cotizacion, refs.operador]);
    await c.query("RESET session_replication_role");
    ordenes.push(id);
  }
  const materialesRonda = [];
  const cotizaciones = [];
  const clientes = [];
  for (let r = 0; r < rondas; r++) {
    materialesRonda.push(await material(`R${r + 1}`, FIXTURES.existenciaDisputa));
    cotizaciones.push({ id: await aprobada(), categoriaId: producto.categoria_id });
    const id = randomUUID();
    await c.query(`INSERT INTO cliente (id, nombre, tipo, contacto_principal, telefono, correo, activo, creado_en, actualizado_en)
      VALUES ($1, $2, 'EMPRESA', 'Fixture', '+505 88880000', $3, true, now(), date_trunc('milliseconds', now()))`,
    [id, `Fixture disputa ${ejecucion} ${r + 1}`, `fixture-${ejecucion}-${r + 1}@carga.test`]);
    clientes.push(id);
  }
  const materialResistencia = await material("RESIST", "1000000.000");
  const clientesResistencia = (await c.query(`SELECT id FROM cliente WHERE ruc LIKE 'CG%' ORDER BY random() LIMIT $1`, [FIXTURES.clientesResistencia])).rows.map((x) => x.id);
  await c.query("COMMIT");
  // Los eventos de bitacora y movimientos posteriores a este instante provienen de la prueba.
  const corte = (await c.query("SELECT now() AS corte")).rows[0].corte.toISOString();
  return { ejecucion, corte, rondas, ordenes, materialesRonda, materialResistencia, cotizaciones, clientes, clientesResistencia,
    existenciaDisputa: FIXTURES.existenciaDisputa, consumoPorVu: FIXTURES.consumoPorVu };
}

async function crearSesiones(c) {
  const usuarios = (await c.query(`
    SELECT u.id, u.correo, p.codigo AS perfil FROM usuario u JOIN usuario_perfil up ON up.usuario_id = u.id JOIN perfil p ON p.id = up.perfil_id
    WHERE u.correo LIKE 'carga%@carga.local' ORDER BY u.correo`)).rows;
  const entorno = leerEntorno();
  const nombreCookie = entorno.SESSION_COOKIE_NAME || "sc_sesion";
  const sesiones = usuarios.map((u) => {
    const token = randomBytes(32).toString("base64url"); // mismo formato que src/lib/auth/tokens.ts
    return { usuarioId: u.id, correo: u.correo, perfil: u.perfil, token, hash: createHash("sha256").update(token).digest("hex") };
  });
  await c.query("BEGIN");
  await c.query(`DELETE FROM sesion WHERE usuario_id IN (SELECT id FROM usuario WHERE correo LIKE 'carga%@carga.local')`);
  await c.query(`
    INSERT INTO sesion (token_hash, usuario_id, creado_en, expira_en)
    SELECT t.h, t.u, now() - interval '1 minute', now() + $3::int * interval '1 hour'
    FROM unnest($1::text[], $2::uuid[]) AS t(h, u)`, [sesiones.map((s) => s.hash), sesiones.map((s) => s.usuarioId), SESION_HORAS]);
  await c.query("COMMIT");
  writeFileSync(ARCHIVO_SESIONES, JSON.stringify(sesiones.map((s) => ({ usuarioId: s.usuarioId, correo: s.correo, perfil: s.perfil,
    cookie: `${nombreCookie}=${s.token}` }))));
  return sesiones.length;
}

async function resumen(c) {
  const { rows } = await c.query(`SELECT
    (SELECT count(*)::int FROM usuario WHERE correo LIKE 'carga%@carga.local') AS usuarios,
    (SELECT count(*)::int FROM cliente) AS clientes, (SELECT count(*)::int FROM material) AS materiales,
    (SELECT count(*)::int FROM cotizacion) AS cotizaciones, (SELECT count(*)::int FROM orden_trabajo) AS ordenes,
    (SELECT count(*)::int FROM movimiento_inventario) AS movimientos, (SELECT count(*)::int FROM bitacora) AS bitacora`);
  return rows[0];
}

async function main() {
  const opciones = leerOpciones(process.argv.slice(2), { "solo-fixtures": "bool", rondas: "valor" });
  const rondas = Number(opciones.rondas ?? FIXTURES.rondas);
  if (!Number.isInteger(rondas) || rondas < 1) throw new Error("--rondas debe ser un entero positivo.");
  const c = await conectar();
  try {
    const sembrada = (await c.query("SELECT 1 FROM usuario WHERE correo = $1", [CORREO_PRIMERO])).rowCount > 0;
    if (!sembrada) {
      if (opciones["solo-fixtures"]) throw new Error("La base no esta sembrada. Corra sin --solo-fixtures.");
      // Una sola transaccion: si algo falla no queda una siembra a medias.
      await c.query("BEGIN");
      for (const [nombre, paso] of [["usuarios, clientes y materiales", sembrarBasicos], ["cotizaciones, ordenes y etapas", sembrarDocumentos],
        ["movimientos del libro", sembrarMovimientos]]) {
        const inicio = Date.now();
        await paso(c);
        log(`Sembrado ${nombre} en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
      }
      await c.query("COMMIT");
    } else {
      log("El volumen ya estaba sembrado. Solo se renuevan fixtures y sesiones.");
    }
    const fixtures = await crearFixtures(c, rondas);
    writeFileSync(ARCHIVO_CONCURRENCIA, JSON.stringify(fixtures, null, 2));
    writeFileSync(ARCHIVO_ESTADO, JSON.stringify({ corte: fixtures.corte, ejecucion: fixtures.ejecucion }));
    log(`Sesiones creadas: ${await crearSesiones(c)}. Fixtures ${fixtures.ejecucion}: ${rondas} rondas.`);
    log(`Totales: ${JSON.stringify(await resumen(c))}`);
  } catch (error) {
    await c.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await c.end();
  }
}

main().catch((error) => {
  process.stderr.write(`La siembra masiva fallo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
