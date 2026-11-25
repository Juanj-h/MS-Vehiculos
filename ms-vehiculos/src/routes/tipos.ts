import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db";
import { asyncH, HttpError } from "../middleware/errors";

const r = Router();
const id = z.string().uuid();

r.get("/", asyncH(async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM tipo_vehiculo ORDER BY nombre`);
  res.json(rows);
}));

r.post("/", asyncH(async (req, res) => {
  const d = z.object({ nombre: z.string().min(1), requierePlaca: z.boolean().default(false) }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO tipo_vehiculo (nombre, requiere_placa) VALUES (upper($1), $2) RETURNING *`, [d.nombre.trim(), d.requierePlaca]);
  res.status(201).json(rows[0]);
}));

r.patch("/:id", asyncH(async (req, res) => {
  const d = z.object({ requierePlaca: z.boolean().optional(), activo: z.boolean().optional() }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE tipo_vehiculo SET requiere_placa=COALESCE($2, requiere_placa), activo=COALESCE($3, activo)
     WHERE id=$1 RETURNING *`, [id.parse(req.params.id), d.requierePlaca ?? null, d.activo ?? null]);
  if (!rows[0]) throw new HttpError(404, "Tipo no encontrado");
  res.json(rows[0]);
}));

export default r;
