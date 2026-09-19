package com.sebast.comercializados_leon.Model.Entity;

// Los tres lugares donde puede haber unidades de un producto. No es una tabla: cada
// uno es una columna de productos (stock, stock_camion, stock_bodega).
//   GENERAL: el local (el stock general sin lo que va en el camion).
//   CAMION:  lo cargado en el camion; sigue contando dentro del stock general.
//   BODEGA:  inventario aparte, que no se puede facturar.
public enum Almacen {
    GENERAL,
    CAMION,
    BODEGA
}
