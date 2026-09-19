package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.sebast.comercializados_leon.Model.Entity.EstadoFactura;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FacturaDTO {

    private Long id;
    private Long clienteId;
    private String clienteNombre;
    private LocalDateTime fecha;
    private BigDecimal total;
    private EstadoFactura estado;
    private List<DetalleFacturaDTO> detalles;

}
