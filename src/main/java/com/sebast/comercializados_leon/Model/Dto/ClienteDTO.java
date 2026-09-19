package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Util.Sanitizador;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// id, totalCompras y destacado solo viajan en las respuestas: ClienteService los
// ignora al crear o actualizar, asi que no se pueden inflar las compras desde afuera.
@Data
// @JsonCreator en el constructor vacio: Jackson 3 (Spring Boot 4) usaria si no el
// constructor con todos los argumentos y se saltaria los setters que limpian el texto.
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class ClienteDTO {

    private Long id;

    @NotBlank(message = "El nombre del cliente es obligatorio")
    @Size(min = 2, max = 120, message = "El nombre debe tener entre 2 y 120 caracteres")
    @Pattern(regexp = Sanitizador.TEXTO, message = "El nombre tiene caracteres no permitidos")
    private String nombre;

    //Opcional
    @Size(min = 3, max = 20, message = "La cedula o NIT debe tener entre 3 y 20 caracteres")
    @Pattern(regexp = Sanitizador.NIT, message = "La cedula o NIT solo admite numeros, letras, puntos y guiones")
    private String nit;

    @Size(min = 7, max = 20, message = "El telefono debe tener entre 7 y 20 caracteres")
    @Pattern(regexp = Sanitizador.TELEFONO, message = "El telefono solo admite numeros, espacios, +, - y parentesis")
    private String telefono;

    //Opcional
    @Size(max = 120, message = "El email no puede superar 120 caracteres")
    @Pattern(regexp = Sanitizador.EMAIL, message = "El email no es valido")
    private String email;

    //Opcional. Texto libre.
    @Size(min = 2, max = 80, message = "La ciudad debe tener entre 2 y 80 caracteres")
    @Pattern(regexp = Sanitizador.TEXTO, message = "La ciudad tiene caracteres no permitidos")
    private String ciudad;

    // Lista de precios: 1 = precio base, 2 = base + recargo, 3 = precio libre.
    // Vacio = 1 al crear; al actualizar, vacio = no se cambia.
    @Min(value = 1, message = "El nivel de precios debe ser 1, 2 o 3")
    @Max(value = 3, message = "El nivel de precios debe ser 1, 2 o 3")
    private Integer nivelPrecio;

    private BigDecimal totalCompras;

    // Se calcula al paso (no se guarda en BD): true si esta entre los clientes destacados
    private Boolean destacado;

    // Setters propios: todo texto llega normalizado a la validacion (vacio -> null,
    // asi los campos opcionales en blanco se guardan como null y no como "").

    public void setNombre(String nombre) {
        this.nombre = Sanitizador.limpiar(nombre);
    }

    public void setNit(String nit) {
        this.nit = Sanitizador.limpiar(nit);
    }

    public void setTelefono(String telefono) {
        this.telefono = Sanitizador.limpiar(telefono);
    }

    public void setEmail(String email) {
        this.email = Sanitizador.limpiar(email);
    }

    public void setCiudad(String ciudad) {
        this.ciudad = Sanitizador.limpiar(ciudad);
    }

}
