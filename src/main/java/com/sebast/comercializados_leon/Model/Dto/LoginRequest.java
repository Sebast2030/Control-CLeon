package com.sebast.comercializados_leon.Model.Dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.sebast.comercializados_leon.Util.Sanitizador;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
// @JsonCreator en el constructor vacio: Jackson 3 (Spring Boot 4) usaria si no el
// constructor con todos los argumentos y se saltaria setUsuario.
@NoArgsConstructor(onConstructor_ = @JsonCreator)
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "El usuario es obligatorio")
    @Size(max = 50, message = "Usuario o contraseña incorrectos")
    @Pattern(regexp = Sanitizador.USUARIO, message = "Usuario o contraseña incorrectos")
    private String usuario;

    // Sin limpiar ni normalizar: la contrasena se compara exactamente como llega.
    // Tope de 72: bcrypt ignora lo que pase de 72 bytes, y evita hashear textos enormes.
    // Excluida de toString para que nunca termine en un log.
    @NotBlank(message = "La contraseña es obligatoria")
    @Size(max = 72, message = "Usuario o contraseña incorrectos")
    @ToString.Exclude
    private String password;

    public void setUsuario(String usuario) {
        this.usuario = usuario == null ? null : usuario.strip();
    }

}
