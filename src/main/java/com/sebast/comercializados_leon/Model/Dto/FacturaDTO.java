package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.sebast.comercializados_leon.Model.Entity.EstadoFactura;
import com.sebast.comercializados_leon.Model.Entity.OrigenVenta;

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
    private BigDecimal totalPagado;
    private EstadoFactura estado;
    private OrigenVenta origen;
    private Integer nivelPrecio;
    private List<DetalleFacturaDTO> detalles;

    // Solo viene al pedir una factura por id (en el listado va en null).
    private List<AbonoDTO> abonos;

}
