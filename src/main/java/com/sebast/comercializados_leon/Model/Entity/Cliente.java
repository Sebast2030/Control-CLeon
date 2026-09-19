package com.sebast.comercializados_leon.Model.Entity;

import java.math.BigDecimal;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "clientes")
@Data
@NoArgsConstructor
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "El nombre del cliente es obligatorio")
    @Column(nullable = false)
    private String nombre;

    //No es un parametro obligatorio
    @Column(name = "cedula_nit")
    private String nit;

    @Column
    private String telefono;

    //No es un parametro obligatorio
    @Column
    private String email;

    // Se actualiza automaticamente cada vez que se factura al cliente.
    // Sirve como base para determinar los "clientes destacados".
    @Column(name = "total_compras", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalCompras = BigDecimal.ZERO;
}
