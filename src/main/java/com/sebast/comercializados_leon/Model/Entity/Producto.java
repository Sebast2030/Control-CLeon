package com.sebast.comercializados_leon.Model.Entity;

import java.math.BigDecimal;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity //Define que la clase es de entidades, o objetos
@Table(name = "productos")
@Data //Genera los Setters ans Getters y toString
@NoArgsConstructor //Genera un constructor vacio
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "El codigo de producto es obligatorio.")
    @Column (nullable = false, unique = true, length = 50)
    private String codigo;

    @NotBlank(message = "El nombre del producto es obligatorio.")
    @Column(nullable = false) //Column configura las propiedades de la columna en la base de datos
    private String nombre;

    @Column
    private String categoria;

    @NotNull(message = "El precio es obligatorio.")
    @PositiveOrZero(message = "El precio no puede ser negativo.")
    @Column(nullable = false, precision = 12, scale = 2) //precision define la cantidad de digitos, y scale los digitos numerales
    private BigDecimal precio;

    @NotNull(message = "El stock es obligatorio.")
    @PositiveOrZero(message = "El stock no puede ser negativo.")
    @Column(nullable = false)
    private Integer stock;

    @Column
    private String marca;

    // Parte del stock general que va cargada en el camion. NO es un inventario aparte:
    // esas unidades siguen contando en stock, por eso nunca puede ser mayor que stock
    // (la base lo exige con un CHECK). Vender desde el camion descuenta de los dos.
    @Column(name = "stock_camion", nullable = false)
    private Integer stockCamion = 0;

    // Inventario de bodega: independiente del general y no se puede facturar.
    @Column(name = "stock_bodega", nullable = false)
    private Integer stockBodega = 0;

    // Unidades del stock general que estan en el local (lo que se vende desde "General").
    public int stockEnLocal() {
        return stock - stockCamion;
    }

}
