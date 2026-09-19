package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Util.Sanitizador;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// id y codigo solo viajan en las respuestas: al crear o actualizar se ignoran
// (el codigo lo genera el backend y no se puede editar).
@Data
// @JsonCreator en el constructor vacio: Jackson 3 (Spring Boot 4) usaria si no el
// constructor con todos los argumentos y se saltaria los setters que limpian el texto.
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class ProductoDTO {

    private Long id;

    private String codigo;

    @NotBlank(message = "El nombre del producto es obligatorio")
    @Size(min = 2, max = 120, message = "El nombre debe tener entre 2 y 120 caracteres")
    @Pattern(regexp = Sanitizador.TEXTO, message = "El nombre tiene caracteres no permitidos")
    private String nombre;

    // Ademas de esto, ProductoService exige que sea una de las categorias de la lista fija.
    @NotBlank(message = "La categoria es obligatoria")
    @Size(max = 30, message = "Categoria invalida")
    private String categoria;

    // Precio NUMERIC(12,2) en la base: hasta 10 digitos enteros y 2 decimales.
    @NotNull(message = "El precio es obligatorio")
    @PositiveOrZero(message = "El precio no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El precio admite hasta 10 digitos y 2 decimales")
    private BigDecimal precio;

    @NotNull(message = "El stock es obligatorio")
    @PositiveOrZero(message = "El stock no puede ser negativo")
    @Max(value = 1_000_000, message = "El stock no puede superar 1.000.000 unidades")
    private Integer stock;

    // Ademas de esto, ProductoService exige que sea una de las marcas de la lista fija.
    @NotBlank(message = "La marca es obligatoria")
    @Size(max = 30, message = "Marca invalida")
    private String marca;

    // Setters propios: Jackson los usa al leer el JSON, asi que todo texto llega ya
    // normalizado a la validacion. Lombok no genera los que ya existen.

    public void setNombre(String nombre) {
        this.nombre = Sanitizador.limpiar(nombre);
    }

    public void setCategoria(String categoria) {
        this.categoria = Sanitizador.limpiar(categoria);
    }

    public void setMarca(String marca) {
        this.marca = Sanitizador.limpiar(marca);
    }

}
