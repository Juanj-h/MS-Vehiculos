import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../config/db";
import { asyncH, HttpError } from "../middleware/errors";
import { ingresoAbierto } from "../services/eventos";

const r = Router();

const ingresoSchema = z.object({
  vehiculoId: z.string().uuid(),
  autorizacionId: z.string().uuid().optional(),   // referencia lógica, cuando exista
  observaciones: z.string().optional(),
});
const salidaSchema = z.object({
  vehiculoId: z.string().uuid(),
  eventoIngresoId: z.string().uuid().optional(),  // si se omite, se cierra el ingreso abierto del vehículo
  observaciones: z.string().optional(),
});

// Registrar INGRESO (guarda = cuenta autenticada)
r.post("/ingreso", asyncH(async (req, res) => {
  const d = ingresoSchema.parse(req.body);
  const row = await withTx(async (c) => {
    const v = (await c.query(`SELECT id, estado FROM vehiculo WHERE id=$1 FOR UPDATE`, [d.vehiculoId])).rows[0];
    if (!v) throw new HttpError(404, "Vehículo no encontrado");
    if (v.estado !== "ACTIVO") throw new HttpError(409, "El vehículo está cancelado");
    const abierto = await ingresoAbierto(c, d.vehiculoId);
    if (abierto) throw new HttpError(409, "El vehículo ya tiene un ingreso abierto sin salida", { ingresoAbiertoId: abierto.id });
    return (await c.query(
      `INSERT INTO evento_vehiculo (vehiculo_id, tipo_evento, guarda_id, autorizacion_id, observaciones)
       VALUES ($1,'INGRESO',$2,$3,$4) RETURNING *`,
      [d.vehiculoId, res.locals.cuentaId, d.autorizacionId ?? null, d.observaciones ?? null])).rows[0];
  });
  res.status(201).json(row);
}));

// Registrar SALIDA: cierra el ingreso abierto (relación CIERRA)
r.post("/salida", asyncH(async (req, res) => {
  const d = salidaSchema.parse(req.body);
  const row = await withTx(async (c) => {
    const v = (await c.query(`SELECT id FROM vehiculo WHERE id=$1 FOR UPDATE`, [d.vehiculoId])).rows[0];
    if (!v) throw new HttpError(404, "Vehículo no encontrado");
    const abierto = await ingresoAbierto(c, d.vehiculoId, d.eventoIngresoId);
    if (!abierto) throw new HttpError(409, d.eventoIngresoId
      ? "El ingreso indicado no existe para este vehículo o ya fue cerrado"
      : "El vehículo no tiene un ingreso abierto que cerrar");
    return (await c.query(
      `INSERT INTO evento_vehiculo (vehiculo_id, tipo_evento, guarda_id, evento_ingreso_id, observaciones)
       VALUES ($1,'SALIDA',$2,$3,$4) RETURNING *`,
      [d.vehiculoId, res.locals.cuentaId, abierto.id, d.observaciones ?? null])).rows[0];
  });
  res.status(201).json(row);
}));

// Vehículos actualmente dentro del conjunto (ingresos abiertos)
r.get("/abiertos", asyncH(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT i.id AS evento_ingreso_id, i.fecha_hora AS ingreso, i.guarda_id, i.autorizacion_id,
            v.id AS vehiculo_id, v.placa, v.identificacion, v.unidad_id, v.propietario_id, t.nombre AS tipo
     FROM evento_vehiculo i
     JOIN vehiculo v ON v.id=i.vehiculo_id JOIN tipo_vehiculo t ON t.id=v.tipo_id
     WHERE i.tipo_evento='INGRESO'
       AND NOT EXISTS (SELECT 1 FROM evento_vehiculo s WHERE s.evento_ingreso_id=i.id)
     ORDER BY i.fecha_hora`);
  res.json(rows);
}));

r.get("/", asyncH(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(q.limit ?? 100), 500);
  const { rows } = await pool.query(
    `SELECT * FROM evento_vehiculo
     WHERE ($1::uuid IS NULL OR vehiculo_id=$1) AND ($2::text IS NULL OR tipo_evento=$2)
       AND ($3::text IS NULL OR guarda_id=$3) AND ($4::timestamptz IS NULL OR fecha_hora>=$4)
       AND ($5::timestamptz IS NULL OR fecha_hora<=$5)
     ORDER BY fecha_hora DESC LIMIT $6`,
    [q.vehiculoId ?? null, q.tipo ?? null, q.guardaId ?? null, q.desde ?? null, q.hasta ?? null, limit]);
  res.json(rows);
}));

export default r;
