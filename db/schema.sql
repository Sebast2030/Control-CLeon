-- ==========================================================
-- Comercializadora Leon - Esquema de base de datos
-- PostgreSQL 14+
-- ==========================================================
-- Este script crea las 4 tablas principales del sistema.
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
    marca       VARCHAR(150)
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
    total_compras  NUMERIC(14,2)  NOT NULL DEFAULT 0 CHECK (total_compras >= 0)
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre         ON clientes (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_clientes_total_compras  ON clientes (total_compras DESC);
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
                 CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON facturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha       ON facturas (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_estado       ON facturas (estado);

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
-- Fin del script
-- ==========================================================
