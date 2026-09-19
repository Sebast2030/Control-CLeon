package com.sebast.comercializados_leon.Model.Dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Model.Entity.Almacen;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Sumar unidades nuevas a un producto (llego mercancia), sin tocar nada mas.
// Solo en GENERAL o BODEGA: el camion se llena con traslados desde el general.
@Data
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class EntradaStockRequest {

    @NotNull(message = "El inventario es obligatorio")
    private Almacen almacen;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser al menos 1")
    @Max(value = 1_000_000, message = "La cantidad no puede superar 1.000.000 unidades")
    private Integer cantidad;

}
