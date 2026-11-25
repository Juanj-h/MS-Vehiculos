import { PoolClient } from "pg";

// Ingreso del vehículo que aún no tiene una salida que lo cierre
export async function ingresoAbierto(c: PoolClient, vehiculoId: string, ingresoId?: string) {
  const { rows } = await c.query(
    `SELECT i.* FROM evento_vehiculo i
     WHERE i.vehiculo_id=$1 AND i.tipo_evento='INGRESO' AND ($2::uuid IS NULL OR i.id=$2)
       AND NOT EXISTS (SELECT 1 FROM evento_vehiculo s WHERE s.evento_ingreso_id = i.id)
     ORDER BY i.fecha_hora DESC LIMIT 1`,
    [vehiculoId, ingresoId ?? null]);
  return rows[0] as { id: string; fecha_hora: Date } | undefined;
}
