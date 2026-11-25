import { NextFunction, Request, Response } from "express";

// Cuenta responsable de la acción: administrador (gestión de vehículos) o guarda (eventos).
// TODO: reemplazar por validación del JWT emitido por MS-Acceso (id de cuenta y rol: ADMIN / GUARDA).
export function cuentaResponsable(req: Request, res: Response, next: NextFunction) {
  const cuenta = req.header("x-cuenta-id");
  if (!cuenta && req.method !== "GET") {
    return res.status(401).json({ error: "Falta la cuenta responsable (header x-cuenta-id)" });
  }
  res.locals.cuentaId = cuenta ?? "anonimo";
  next();
}
