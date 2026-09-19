-- ==========================================================
-- Comercializadora Leon - Esquema de base de datos
-- PostgreSQL 14+
-- ==========================================================
-- Este script crea las 5 tablas principales del sistema.
-- El backend usa ddl-auto=validate y se conecta con un rol sin permisos para crear
-- tablas, asi que las tablas SIEMPRE se crean con este script, como postgres.
-- Despues, correr db/seguridad.sql (rol cleon_app, login y RLS) y db/admin.sql
-- (usuario administrador). Sin eso el backend no puede conectarse.

-- ---------- Extensiones utiles ----------
-- (No obligatorio, pero deja preparado el terreno si mas adelante se necesitan UUIDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- Tabla: productos
-- ==========================================================
CREATE TABLE IF NOT EXISTS productos (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(50)    NOT NULL,   -- codigo que el usuario escribe a mano (ej: "EX-001")
    nombre      VARCHAR(255)   NOT NULL,
    categoria   VARCHAR(150),
    precio      NUMERIC(12,2)  NOT NULL CHECK (precio >= 0),
    stock       INTEGER        NOT NULL CHECK (stock >= 0),
    marca       VARCHAR(150),
    -- Parte del stock general que va cargada en el camion (nunca mas que stock).
    stock_camion INTEGER       NOT NULL DEFAULT 0,
    -- Inventario de bodega: aparte del general y no se puede facturar.
    stock_bodega INTEGER       NOT NULL DEFAULT 0,
    CONSTRAINT ck_productos_stock_camion CHECK (stock_camion >= 0 AND stock_camion <= stock),
    CONSTRAINT ck_productos_stock_bodega CHECK (stock_bodega >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_productos_codigo ON productos (LOWER(codigo));
CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (LOWER(categoria));

-- ==========================================================
-- Tabla: clientes
-- ==========================================================
CREATE TABLE IF NOT EXISTS clientes (
    id             BIGSERIAL PRIMARY KEY,
    nombre         VARCHAR(255)   NOT NULL,
    cedula_nit     VARCHAR(50),                     -- opcional
    telefono       VARCHAR(50),
    email          VARCHAR(255),                    -- opcional
    total_compras  NUMERIC(14,2)  NOT NULL DEFAULT 0 CHECK (total_compras >= 0),
    ciudad         VARCHAR(80),                     -- opcional, texto libre
    -- Lista de precios: 1 = precio base, 2 = base + 10%, 3 = precio libre en la factura
    nivel_precio   INTEGER        NOT NULL DEFAULT 1,
    CONSTRAINT ck_clientes_nivel_precio CHECK (nivel_precio IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre         ON clientes (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_clientes_total_compras  ON clientes (total_compras DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_ciudad         ON clientes (LOWER(ciudad));
CREATE UNIQUE INDEX IF NOT EXISTS uk_clientes_cedula_nit
    ON clientes (cedula_nit) WHERE cedula_nit IS NOT NULL;

-- ==========================================================
-- Tabla: facturas
-- ==========================================================
CREATE TABLE IF NOT EXISTS facturas (
    id          BIGSERIAL PRIMARY KEY,
    cliente_id  BIGINT         NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    fecha       TIMESTAMP      NOT NULL DEFAULT now(),
    total       NUMERIC(14,2)  NOT NULL DEFAULT 0 CHECK (total >= 0),
    estado      VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE'
                 CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
    origen       VARCHAR(10)   NOT NULL DEFAULT 'GENERAL',  -- de donde salio la mercancia
    nivel_precio INTEGER       NOT NULL DEFAULT 1,          -- lista de precios del cliente al facturar
    total_pagado NUMERIC(14,2) NOT NULL DEFAULT 0,          -- suma de los abonos
    CONSTRAINT ck_facturas_origen       CHECK (origen IN ('GENERAL', 'CAMION')),
    CONSTRAINT ck_facturas_nivel_precio CHECK (nivel_precio IN (1, 2, 3)),
    CONSTRAINT ck_facturas_total_pagado CHECK (total_pagado >= 0 AND total_pagado <= total)
);

CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON facturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha       ON facturas (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_estado       ON facturas (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_origen       ON facturas (origen);

-- ==========================================================
-- Tabla: detalle_factura
-- ==========================================================
CREATE TABLE IF NOT EXISTS detalle_factura (
    id               BIGSERIAL PRIMARY KEY,
    factura_id       BIGINT         NOT NULL REFERENCES facturas(id)  ON DELETE CASCADE,
    producto_id      BIGINT         NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad         INTEGER        NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(12,2)  NOT NULL CHECK (precio_unitario >= 0),
    subtotal         NUMERIC(14,2)  NOT NULL CHECK (subtotal >= 0),
    total            NUMERIC(14,2)  NOT NULL CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_detalle_factura_factura_id  ON detalle_factura (factura_id);
CREATE INDEX IF NOT EXISTS idx_detalle_factura_producto_id ON detalle_factura (producto_id);

-- ==========================================================
-- Tabla: abonos (pagos parciales de una factura; nunca se borran)
-- ==========================================================
CREATE TABLE IF NOT EXISTS abonos (
    id          BIGSERIAL PRIMARY KEY,
    factura_id  BIGINT         NOT NULL REFERENCES facturas(id) ON DELETE RESTRICT,
    monto       NUMERIC(14,2)  NOT NULL CHECK (monto > 0),
    fecha       TIMESTAMP      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonos_factura_id ON abonos (factura_id);

-- ==========================================================
-- Fin del script
-- ==========================================================
