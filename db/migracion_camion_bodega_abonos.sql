-- ============================================================================
-- Migracion: camion, bodega, listas de precios, ciudades y abonos
-- ============================================================================
-- Agrega a una base que ya existe lo que necesita esta version del backend:
--
--   productos : stock_camion (parte del stock general que va en el camion) y
--               stock_bodega (inventario aparte, que no se factura).
--   clientes  : ciudad (texto libre) y nivel_precio (lista de precios 1, 2 o 3).
--   facturas  : origen (GENERAL o CAMION), nivel_precio con el que se facturo y
--               total_pagado (suma de los abonos).
--   abonos    : tabla nueva con cada pago parcial de una factura.
--
-- Se puede ejecutar varias veces sin romper nada. Sin esta migracion el backend
-- nuevo NO arranca (ddl-auto=validate). Ejecutar como el dueno de las tablas
-- (postgres en el PC, cleon_owner en Neon), ANTES de subir el backend nuevo:
--   psql -U postgres -d cleon -f db/migracion_camion_bodega_abonos.sql
-- (si la ruta tiene tildes, pasarlo por stdin: psql -U postgres -d cleon < archivo)
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------- productos ----------
-- stock sigue siendo el stock GENERAL total: incluye lo que va cargado en el camion.
-- Por eso stock_camion nunca puede ser mayor que stock. La bodega va aparte.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_camion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_bodega INTEGER NOT NULL DEFAULT 0;

ALTER TABLE productos DROP CONSTRAINT IF EXISTS ck_productos_stock_camion;
ALTER TABLE productos ADD CONSTRAINT ck_productos_stock_camion
    CHECK (stock_camion >= 0 AND stock_camion <= stock);
ALTER TABLE productos DROP CONSTRAINT IF EXISTS ck_productos_stock_bodega;
ALTER TABLE productos ADD CONSTRAINT ck_productos_stock_bodega CHECK (stock_bodega >= 0);

-- ---------- clientes ----------
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ciudad VARCHAR(80);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nivel_precio INTEGER NOT NULL DEFAULT 1;

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS ck_clientes_nivel_precio;
ALTER TABLE clientes ADD CONSTRAINT ck_clientes_nivel_precio CHECK (nivel_precio IN (1, 2, 3));

CREATE INDEX IF NOT EXISTS idx_clientes_ciudad ON clientes (LOWER(ciudad));

-- ---------- facturas ----------
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS nivel_precio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS total_pagado NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Las facturas que ya estaban pagadas quedan con todo su valor pagado.
UPDATE facturas SET total_pagado = total WHERE estado = 'PAGADA' AND total_pagado <> total;

ALTER TABLE facturas DROP CONSTRAINT IF EXISTS ck_facturas_origen;
ALTER TABLE facturas ADD CONSTRAINT ck_facturas_origen CHECK (origen IN ('GENERAL', 'CAMION'));
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS ck_facturas_nivel_precio;
ALTER TABLE facturas ADD CONSTRAINT ck_facturas_nivel_precio CHECK (nivel_precio IN (1, 2, 3));
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS ck_facturas_total_pagado;
ALTER TABLE facturas ADD CONSTRAINT ck_facturas_total_pagado
    CHECK (total_pagado >= 0 AND total_pagado <= total);

CREATE INDEX IF NOT EXISTS idx_facturas_origen ON facturas (origen);

-- ---------- abonos ----------
-- Cada pago parcial queda registrado. Como las facturas, nunca se borran ni se editan.
CREATE TABLE IF NOT EXISTS abonos (
    id          BIGSERIAL PRIMARY KEY,
    factura_id  BIGINT         NOT NULL REFERENCES facturas(id) ON DELETE RESTRICT,
    monto       NUMERIC(14,2)  NOT NULL CHECK (monto > 0),
    fecha       TIMESTAMP      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonos_factura_id ON abonos (factura_id);

-- Permisos y RLS de la tabla nueva (lo mismo que hace db/seguridad.sql): cleon_app
-- solo puede leer e insertar abonos, y solo con una sesion de admin vigente.
REVOKE ALL ON public.abonos FROM PUBLIC, cleon_app;
GRANT SELECT, INSERT ON public.abonos TO cleon_app;
SELECT format('GRANT USAGE ON SEQUENCE %s TO cleon_app', pg_get_serial_sequence('public.abonos', 'id')) \gexec

ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solo_admin ON public.abonos;
CREATE POLICY solo_admin ON public.abonos FOR ALL TO cleon_app
    USING ((SELECT public.cleon_es_admin()))
    WITH CHECK ((SELECT public.cleon_es_admin()));

COMMIT;

\echo 'Migracion aplicada: camion, bodega, listas de precios, ciudades y abonos.'
