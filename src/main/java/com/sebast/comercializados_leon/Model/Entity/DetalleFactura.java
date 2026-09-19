package com.sebast.comercializados_leon.Model.Entity;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "detalle_factura")
@Data
@NoArgsConstructor
public class DetalleFactura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "factura_id", nullable = false)
    @JsonBackReference
    // Referencia de vuelta a la factura: excluida para no generar recursion infinita.
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Factura factura;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Producto producto;

    @Column(nullable = false)
    private Integer cantidad;

    @Column(name = "precio_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioUnitario;

    // subtotal = cantidad * precioUnitario (sin descuentos)
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    /* total = subtotal aplicando descuentos/ajustes de esta linea (por ahora igual al subtotal,
    queda listo por si mas adelante se agregan descuentos por producto) */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;
}
