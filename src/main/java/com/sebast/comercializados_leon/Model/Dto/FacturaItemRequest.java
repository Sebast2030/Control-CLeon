package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonCreator;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class FacturaItemRequest {

    @NotNull(message = "El id del producto es obligatorio")
    @Positive(message = "El id del producto es invalido")
    private Long productoId;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser al menos 1")
    @Max(value = 10_000, message = "La cantidad no puede superar 10.000 unidades por linea")
    private Integer cantidad;

    // Solo se usa si el cliente es de la lista de precios 3 (precio libre), y ahi es
    // obligatorio. En las listas 1 y 2 se ignora: el precio lo calcula el backend.
    @Positive(message = "El precio debe ser mayor que cero")
    @Digits(integer = 10, fraction = 2, message = "El precio admite hasta 10 digitos y 2 decimales")
    private BigDecimal precioUnitario;
}
