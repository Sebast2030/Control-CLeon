-- ============================================================================
-- Migracion: total_compras cuenta solo facturas PAGADA
-- ============================================================================
-- Antes, el total comprado de un cliente se sumaba al CREAR la factura, aunque
-- quedara pendiente de pago. Eso hacia que un cliente apareciera como
-- "destacado" por dinero que todavia no habia pagado, y que el total del
-- cliente nunca cuadrara con el "Facturado" del dashboard (que solo cuenta
-- las pagadas).
--
-- Ahora el monto se suma en pagar() y se resta en anular() solo si estaba pagada.
-- Este script realinea los datos que ya existen en la base con esa regla.
--
-- Ejecutar UNA sola vez, despues de actualizar el backend:
--   psql -U postgres -d cleon -f db/migracion_total_compras_solo_pagadas.sql
-- ============================================================================

BEGIN;

UPDATE clientes c
SET total_compras = COALESCE((
        SELECT SUM(f.total)
        FROM facturas f
        WHERE f.cliente_id = c.id
          AND f.estado = 'PAGADA'
    ), 0);

-- Verificacion: lista lo que quedo, para revisar antes de confirmar.
SELECT c.id,
       c.nombre,
       c.total_compras,
       (SELECT COUNT(*) FROM facturas f WHERE f.cliente_id = c.id AND f.estado = 'PAGADA')    AS facturas_pagadas,
       (SELECT COUNT(*) FROM facturas f WHERE f.cliente_id = c.id AND f.estado = 'PENDIENTE') AS facturas_pendientes
FROM clientes c
ORDER BY c.total_compras DESC;

COMMIT;
