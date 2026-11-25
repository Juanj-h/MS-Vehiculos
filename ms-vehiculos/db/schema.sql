CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos de vehículo registrados en el conjunto (extensible: "otro tipo registrado")
CREATE TABLE IF NOT EXISTS tipo_vehiculo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL UNIQUE,
  requiere_placa BOOLEAN NOT NULL DEFAULT FALSE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO tipo_vehiculo (nombre, requiere_placa) VALUES
  ('CARRO', TRUE), ('MOTOCICLETA', TRUE), ('BICICLETA', FALSE), ('OTRO', FALSE)
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS vehiculo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id        UUID NOT NULL REFERENCES tipo_vehiculo(id),
  placa          TEXT,
  identificacion TEXT,                    -- otra identificación cuando no aplica placa (ej. serial)
  propietario_id UUID,                    -- referencia lógica a MS-Propietarios
  unidad_id      UUID,                    -- referencia lógica a MS-Propietarios
  estado         TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','CANCELADO')),
  registrado_por TEXT NOT NULL,           -- cuenta del administrador
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (placa IS NOT NULL OR identificacion IS NOT NULL),
  CHECK (propietario_id IS NOT NULL OR unidad_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculo_placa
  ON vehiculo (placa) WHERE placa IS NOT NULL AND estado = 'ACTIVO';
CREATE INDEX IF NOT EXISTS ix_vehiculo_propietario ON vehiculo (propietario_id);
CREATE INDEX IF NOT EXISTS ix_vehiculo_unidad ON vehiculo (unidad_id);

CREATE TABLE IF NOT EXISTS evento_vehiculo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id       UUID NOT NULL REFERENCES vehiculo(id),
  tipo_evento       TEXT NOT NULL CHECK (tipo_evento IN ('INGRESO','SALIDA')),
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT now(),
  guarda_id         TEXT NOT NULL,        -- referencia lógica: cuenta del guarda (MS-Acceso)
  autorizacion_id   UUID,                 -- referencia lógica: autorización (cuando exista)
  evento_ingreso_id UUID REFERENCES evento_vehiculo(id),  -- relación unaria CIERRA
  observaciones     TEXT,
  CHECK (
    (tipo_evento = 'INGRESO' AND evento_ingreso_id IS NULL) OR
    (tipo_evento = 'SALIDA'  AND evento_ingreso_id IS NOT NULL)
  )
);
-- Un ingreso solo puede ser cerrado por una salida
CREATE UNIQUE INDEX IF NOT EXISTS ux_evento_cierra_unico
  ON evento_vehiculo (evento_ingreso_id) WHERE evento_ingreso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_evento_vehiculo_fecha ON evento_vehiculo (vehiculo_id, fecha_hora DESC);
