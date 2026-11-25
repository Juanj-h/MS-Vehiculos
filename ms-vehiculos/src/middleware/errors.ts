import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export const asyncH = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err instanceof ZodError) return res.status(400).json({ error: "Datos inválidos", detalles: err.flatten() });
  if (err?.code === "23505") return res.status(409).json({ error: "Registro duplicado", detalle: err.detail });
  if (err?.code === "23503") return res.status(409).json({ error: "Referencia inválida", detalle: err.detail });
  console.error(err);
  res.status(500).json({ error: "Error interno" });
}
