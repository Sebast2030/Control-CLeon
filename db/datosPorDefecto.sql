-- ==========================================================
-- Comercializadora Leon - Datos de prueba (OPCIONAL)
-- Ejecutar solo despues de schema.sql, si quieres tener datos
-- de ejemplo para probar la API o el frontend.
-- ==========================================================

INSERT INTO productos (codigo, nombre, categoria, precio, stock, marca) VALUES
    ('SC-0001', 'Silenciador Renault 9', 'Silenciador', 50000.00, 24, 'CLeon'),
    ('SC-0002', 'Silenciador Aveo largo', 'Silenciador', 85000.00, 12, 'CLeon'),
    ('SC-0003', 'Silenciador Aveo corto', 'Silenciador', 83000.00, 16, 'CLeon'),
    ('SC-0004', 'Silenciador Renault 12', 'Silenciador', 48000.00, 20, 'CLeon'),
    ('SC-0005', 'Silenciador Trooper', 'Silenciador', 58000.00, 26, 'CLeon'),
    ('SG-0001', 'Silenciador Renault 9', 'Silenciador', 58000.00, 6, 'TMP'),
    ('SG-0002', 'Silenciador Aveo largo', 'Silenciador', 98000.00, 2, 'TMP'),
    ('SG-0003', 'Silenciador Aveo corto', 'Silenciador', 102000.00, 6, 'TMP'),
    ('SG-0004', 'Silenciador Renault 12', 'Silenciador', 55000.00, 5, 'TMP'),
    ('SG-0005', 'Silenciador Renault Trooper', 'Silenciador', 60000.00, 4, 'TMP'),
    ('CA-0001', 'Catalizador Redondo pequeno (E3)', 'Catalizador', 280000, 20, 'Cleon'),
    ('CA-0002', 'Catalizador Redondo mediano (E3)', 'Catalizador', 320000, 18, 'Cleon'),
    ('CA-0003', 'Catalizador Redondo grande (E3)', 'Catalizador', 360000, 15, 'Cleon'),
    ('CA-0004', 'Catalizador Plano 2.5" (E3)', 'Catalizador', 380000, 21, 'Cleon'),
    ('CA-0005', 'Catalizador Redondo protector (E4)', 'Catalizador', 390000, 14, 'Cleon'),
    ('CA-0006', 'Catalizador Tracker (E5)', 'Catalizador', 680000, 10, 'Cleon'),
    ('CA-0007', 'Catalizador Captiva (E5)', 'Catalizador', 620000, 7, 'Cleon');

INSERT INTO clientes (nombre, cedula_nit, telefono, email, total_compras) VALUES
    ('Cristian Gomez', '1020304050', '3001234567', 'cristian.gomez@gmail.com', 0),
    ('Exostos la 13',   '900123456-1', '3109876543', 'exostoslatrece@gamil.com', 0),
    ('Maria Gómez', NULL, '3155551234', 'maria.gomez@gmail.com', 0),
    ('Carlos Rodriguez', '1122334455', '3201122334', NULL, 0);

-- Nota: total_compras se deja en 0 a proposito.
-- El backend lo actualiza automaticamente cada vez que creas una factura
-- a traves de POST /api/facturas, asi que no hace falta llenarlo a mano.
