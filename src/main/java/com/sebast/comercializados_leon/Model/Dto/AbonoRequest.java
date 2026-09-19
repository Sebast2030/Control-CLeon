package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonCreator;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Ademas de esto, FacturaService exige que el abono no supere lo que falta por pagar.
@Data
// @JsonCreator en el constructor vacio: con un solo campo, Jackson podria tomar el
// constructor de un argumento como si el JSON fuera solo el numero.
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class AbonoRequest {

    // NUMERIC(14,2) en la base: hasta 12 digitos enteros y 2 decimales.
    @NotNull(message = "El valor del abono es obligatorio")
    @Positive(message = "El abono debe ser mayor que cero")
    @Digits(integer = 12, fraction = 2, message = "El abono admite hasta 12 digitos y 2 decimales")
    private BigDecimal monto;

}
