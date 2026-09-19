-- ==========================================================
-- Comercializadora Leon - Vaciar todos los datos
-- CUIDADO: esto borra TODOS los registros de las 4 tablas.
-- La estructura (tablas, columnas, CHECK, indices) NO se borra.
-- ==========================================================

TRUNCATE TABLE detalle_factura, facturas, clientes, productos
    RESTART IDENTITY CASCADE;

-- RESTART IDENTITY: reinicia los contadores de id (BIGSERIAL) para que
--                   el proximo registro que crees vuelva a empezar en 1.
-- CASCADE:          se encarga automaticamente del orden de las llaves
--                   foraneas (detalle_factura depende de facturas y productos,
--                   facturas depende de clientes), asi no toca preocuparse
--                   por el orden manualmente.
