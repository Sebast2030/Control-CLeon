package com.sebast.comercializados_leon.Model.Dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Model.Entity.OrigenVenta;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class FacturaCreateRequest {

    @NotNull(message = "El cliente es obligatorio")
    @Positive(message = "El cliente es invalido")
    private Long clienteId;

    @NotEmpty(message = "La factura debe tener al menos un producto")
    @Size(max = 100, message = "La factura no puede tener mas de 100 productos")
    private List<@Valid @NotNull(message = "Hay un producto vacio en la factura") FacturaItemRequest> items;

    // De donde sale la mercancia. Vacio = GENERAL (el local). Un valor que no sea
    // GENERAL ni CAMION hace que el JSON se rechace con 400.
    private OrigenVenta origen;

}
