package com.sebast.comercializados_leon.Model.Dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FacturaItemRequest {

    @NotNull(message = "El id del producto es obligatorio")
    @Positive(message = "El id del producto es invalido")
    private Long productoId;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser al menos 1")
    @Max(value = 10_000, message = "La cantidad no puede superar 10.000 unidades por linea")
    private Integer cantidad;
}
