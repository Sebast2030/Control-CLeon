package com.sebast.comercializados_leon.Model.Dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Model.Entity.Almacen;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Mover unidades de un producto entre el local (GENERAL), el camion y la bodega.
// Un almacen que no sea de la lista hace que el JSON se rechace con 400.
@Data
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class TrasladoRequest {

    @NotNull(message = "El origen es obligatorio")
    private Almacen origen;

    @NotNull(message = "El destino es obligatorio")
    private Almacen destino;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser al menos 1")
    @Max(value = 1_000_000, message = "La cantidad no puede superar 1.000.000 unidades")
    private Integer cantidad;

}
