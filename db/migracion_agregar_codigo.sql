-- ==========================================================
-- Migracion: agregar columna "codigo" a productos existentes
-- Usar SOLO si tu tabla productos ya existe y tiene datos que
-- no quieres perder. Si vas a recrear todo desde cero, mejor
-- usa schema.sql directamente.
-- ==========================================================

-- 1. Agregar la columna, primero sin NOT NULL (porque ya hay filas sin valor)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);

-- 2. Si ya tienes productos guardados, dales un codigo temporal unico
--    basado en su id, para poder activar la restriccion NOT NULL despues.
--    Editalos luego manualmente por el codigo real que quieras.
UPDATE productos SET codigo = 'TEMP-' || id WHERE codigo IS NULL;

-- 3. Ahora si, exigir que codigo sea obligatorio
ALTER TABLE productos ALTER COLUMN codigo SET NOT NULL;

-- 4. Evitar codigos repetidos
CREATE UNIQUE INDEX IF NOT EXISTS uk_productos_codigo ON productos (LOWER(codigo));
