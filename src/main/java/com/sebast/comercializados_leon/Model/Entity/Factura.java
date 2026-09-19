package com.sebast.comercializados_leon.Model.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "facturas")
@Data
@NoArgsConstructor
public class Factura {

    @Id //Define la Primary Key
    @GeneratedValue(strategy = GenerationType.IDENTITY) //Define que su valor se genera automaticamente y secuencialmente
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false) //fetch hace que solo cargue el cliente cuando es solicitado, y optional = false, indica que no puede existir una factura sin clinete
    @JoinColumn(name = "cliente_id", nullable = false) //nullable es el equivalente a NOT NULL
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Cliente cliente;

    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();

    @Column(nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING) //Se va a enumerar en un tipo Stirng (Pendiente), en vez de una secuencia numerica
    @Column(nullable = false, length = 20) //legth es para definir el tamaño maximo permitido de caracteres
    private EstadoFactura estado = EstadoFactura.PENDIENTE;

    // De donde salio la mercancia: del local (GENERAL) o del camion. Todas las facturas
    // comparten la misma numeracion (el id); el origen solo sirve para filtrar.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrigenVenta origen = OrigenVenta.GENERAL;

    // Lista de precios del cliente en el momento de facturar (1, 2 o 3).
    @Column(name = "nivel_precio", nullable = false)
    private Integer nivelPrecio = 1;

    // Suma de los abonos. Cuando llega al total, la factura pasa a PAGADA.
    @Column(name = "total_pagado", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalPagado = BigDecimal.ZERO;

    @OneToMany(mappedBy = "factura", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)//MappedBy define el dueño del atributo, cascade operaciones CRUD, orphanRemove para eliminar datos de la base de datos
    @JsonManagedReference
    // Excluido de toString/equals porque DetalleFactura apunta de vuelta a Factura:
    // incluirlo genera recursion infinita (StackOverflowError).
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<DetalleFactura> detalles = new ArrayList<>();

    public void agregarDetalle(DetalleFactura detalle){
        detalles.add(detalle);
        detalle.setFactura(this);
    }

}
