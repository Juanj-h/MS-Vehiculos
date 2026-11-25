import { Router } from "express";
import { PoolClient } from "pg";
import { z } from "zod";
import { pool, withTx } from "../config/db";
import { asyncH, HttpError } from "../middleware/errors";
import { ingresoAbierto } from "../services/eventos";

const r = Router();
const id = z.string().uuid();

const crear = z.object({
  tipoId: z.string().uuid(),
  placa: z.string().trim().min(1).optional(),
  identificacion: z.string().trim().min(1).optional(),
  propietarioId: z.string().uuid().optional(),
  unidadId: z.string().uuid().optional(),
});
const actualizar = crear.partial();

const normalizarPlaca = (p?: string | null) => (p ? p.replace(/\s+/g, "").toUpperCase() : null);

// Reglas de negocio: placa obligatoria si el tipo lo exige; al menos una identificación; propietario o unidad
async function validar(c: PoolClient, v: { tipoId: string; placa: string | null; identificacion: string | null; propietarioId: string | null; unidadId: string | null }) {
  const tipo = (await c.query(`SELECT * FROM tipo_vehiculo WHERE id=$1`, [v.tipoId])).rows[0];
  if (!tipo) throw new HttpError(404, "Tipo de vehículo no encontrado");
  if (!tipo.activo) throw new HttpError(409, "El tipo de vehículo está inactivo");
  if (tipo.requiere_placa && !v.placa) throw new HttpError(400, `El tipo ${tipo.nombre} requiere placa`);
  if (!v.placa && !v.identificacion) throw new HttpError(400, "Debe indicar placa o identificación");
  if (!v.propietarioId && !v.unidadId) throw new HttpError(400, "Debe indicar propietario o unidad asociados");
}

r.post("/", asyncH(async (req, res) => {
  const d = crear.parse(req.body);
  const v = { tipoId: d.tipoId, placa: normalizarPlaca(d.placa), identificacion: d.identificacion ?? null,
              propietarioId: d.propietarioId ?? null, unidadId: d.unidadId ?? null };
  const row = await withTx(async (c) => {
    await validar(c, v);
    const { rows } = await c.query(
      `INSERT INTO vehiculo (tipo_id, placa, identificacion, propietario_id, unidad_id, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [v.tipoId, v.placa, v.identificacion, v.propietarioId, v.unidadId, res.locals.cuentaId]);
    return rows[0];
  });
  res.status(201).json(row);
}));

r.get("/", asyncH(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { rows } = await pool.query(
    `SELECT v.*, t.nombre AS tipo FROM vehiculo v JOIN tipo_vehiculo t ON t.id=v.tipo_id
     WHERE ($1::text IS NULL OR v.placa = upper($1)) AND ($2::uuid IS NULL OR v.propietario_id=$2)
       AND ($3::uuid IS NULL OR v.unidad_id=$3) AND ($4::uuid IS NULL OR v.tipo_id=$4)
       AND ($5::text IS NULL OR v.estado=$5)
     ORDER BY v.created_at DESC`,
    [q.placa ?? null, q.propietarioId ?? null, q.unidadId ?? null, q.tipoId ?? null, q.estado ?? null]);
  res.json(rows);
}));

r.get("/:id", asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.*, t.nombre AS tipo FROM vehiculo v JOIN tipo_vehiculo t ON t.id=v.tipo_id WHERE v.id=$1`, [id.parse(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, "Vehículo no encontrado");
  res.json(rows[0]);
}));

r.put("/:id", asyncH(async (req, res) => {
  const vid = id.parse(req.params.id);
  const d = actualizar.parse(req.body);
  const row = await withTx(async (c) => {
    const prev = (await c.query(`SELECT * FROM vehiculo WHERE id=$1 FOR UPDATE`, [vid])).rows[0];
    if (!prev) throw new HttpError(404, "Vehículo no encontrado");
    if (prev.estado === "CANCELADO") throw new HttpError(409, "El vehículo está cancelado");
    const v = {
      tipoId: d.tipoId ?? prev.tipo_id,
      placa: d.placa !== undefined ? normalizarPlaca(d.placa) : prev.placa,
      identificacion: d.identificacion ?? prev.identificacion,
      propietarioId: d.propietarioId ?? prev.propietario_id,
      unidadId: d.unidadId ?? prev.unidad_id,
    };
    await validar(c, v);
    const { rows } = await c.query(
      `UPDATE vehiculo SET tipo_id=$2, placa=$3, identificacion=$4, propietario_id=$5, unidad_id=$6, updated_at=now()
       WHERE id=$1 RETURNING *`, [vid, v.tipoId, v.placa, v.identificacion, v.propietarioId, v.unidadId]);
    return rows[0];
  });
  res.json(row);
}));

// Cancelación lógica: no se permite con un ingreso abierto
r.delete("/:id", asyncH(async (req, res) => {
  const vid = id.parse(req.params.id);
  const row = await withTx(async (c) => {
    const prev = (await c.query(`SELECT * FROM vehiculo WHERE id=$1 FOR UPDATE`, [vid])).rows[0];
    if (!prev) throw new HttpError(404, "Vehículo no encontrado");
    if (prev.estado === "CANCELADO") throw new HttpError(409, "El vehículo ya está cancelado");
    const abierto = await ingresoAbierto(c, vid);
    if (abierto) throw new HttpError(409, "El vehículo tiene un ingreso abierto sin salida", { ingresoAbiertoId: abierto.id });
    return (await c.query(`UPDATE vehiculo SET estado='CANCELADO', updated_at=now() WHERE id=$1 RETURNING *`, [vid])).rows[0];
  });
  res.json(row);
}));

// Historial de eventos del vehículo
r.get("/:id/eventos", asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM evento_vehiculo WHERE vehiculo_id=$1 ORDER BY fecha_hora DESC`, [id.parse(req.params.id)]);
  res.json(rows);
}));

export default r;
