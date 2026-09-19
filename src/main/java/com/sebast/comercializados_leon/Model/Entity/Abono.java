package com.sebast.comercializados_leon.Model.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

// Pago parcial de una factura. Como las facturas, nunca se borra ni se edita
// (cleon_app solo tiene SELECT e INSERT sobre abonos).
@Entity
@Table(name = "abonos")
@Data
@NoArgsConstructor
public class Abono {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Relacion de un solo lado (Factura no guarda la lista de abonos). Se excluye de
    // toString/equals igual que las demas, por si algun dia se vuelve bidireccional.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "factura_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Factura factura;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();
}
