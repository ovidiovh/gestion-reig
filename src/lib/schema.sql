-- =============================================
-- RETIRADAS DE CAJA — Schema
-- =============================================

-- Sesión de retirada (una por día/operación)
CREATE TABLE IF NOT EXISTS retiradas_sesion (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha         TEXT NOT NULL,                    -- YYYY-MM-DD
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  usuario       TEXT NOT NULL DEFAULT 'ovidio',
  total_cajas   REAL NOT NULL DEFAULT 0,          -- suma automática de todas las cajas
  total_audit   REAL,                             -- suma del conteo de auditoría
  destino       TEXT NOT NULL DEFAULT 'caja_fuerte', -- caja_fuerte | entrega_bea | banco
  origen        TEXT NOT NULL DEFAULT 'farmacia',    -- farmacia | optica
  remesa_id     INTEGER REFERENCES retiradas_remesa(id), -- NULL si no está en remesa
  auditada      INTEGER NOT NULL DEFAULT 0,       -- 0=pendiente, 1=cuadra, -1=descuadre
  notas         TEXT
);

-- Detalle por caja dentro de una sesión
CREATE TABLE IF NOT EXISTS retiradas_caja (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id     INTEGER NOT NULL REFERENCES retiradas_sesion(id),
  num_caja      INTEGER NOT NULL CHECK(num_caja BETWEEN 1 AND 11),
  b200          INTEGER NOT NULL DEFAULT 0,       -- cantidad de billetes de 200€
  b100          INTEGER NOT NULL DEFAULT 0,
  b50           INTEGER NOT NULL DEFAULT 0,
  b20           INTEGER NOT NULL DEFAULT 0,
  b10           INTEGER NOT NULL DEFAULT 0,
  b5            INTEGER NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,          -- calculado: 200*b200 + 100*b100 + ...
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sesion_id, num_caja)
);

-- Remesa: agrupación de sesiones para un único ingreso bancario
CREATE TABLE IF NOT EXISTS retiradas_remesa (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  total         REAL NOT NULL DEFAULT 0,           -- suma de las sesiones agrupadas
  estado        TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | confirmada
  confirmada_at TEXT,                              -- fecha de confirmación (email banco)
  email_subject TEXT,                              -- asunto del email de confirmación
  notas         TEXT
);

-- Auditoría: conteo global de billetes para verificar
CREATE TABLE IF NOT EXISTS retiradas_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id     INTEGER NOT NULL UNIQUE REFERENCES retiradas_sesion(id),
  b200          INTEGER NOT NULL DEFAULT 0,
  b100          INTEGER NOT NULL DEFAULT 0,
  b50           INTEGER NOT NULL DEFAULT 0,
  b20           INTEGER NOT NULL DEFAULT 0,
  b10           INTEGER NOT NULL DEFAULT 0,
  b5            INTEGER NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,
  cuadra        INTEGER NOT NULL DEFAULT 0,       -- 1=sí, 0=no
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
