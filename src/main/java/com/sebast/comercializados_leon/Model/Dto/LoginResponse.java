package com.sebast.comercializados_leon.Model.Dto;

import java.time.OffsetDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    // Token de sesion. Se entrega una unica vez; el backend solo guarda su hash.
    // El frontend lo manda en cada peticion como "Authorization: Bearer <token>".
    @ToString.Exclude
    private String token;

    private String usuario;

    // Vencimiento absoluto de la sesion. Antes de eso tambien se cierra sola tras
    // 60 minutos sin actividad (ver db/seguridad.sql).
    private OffsetDateTime expiraEn;

}
