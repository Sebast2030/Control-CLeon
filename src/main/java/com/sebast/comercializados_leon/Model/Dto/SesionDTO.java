package com.sebast.comercializados_leon.Model.Dto;

import java.time.OffsetDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Datos de la sesion actual, para que el frontend sepa quien esta conectado.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SesionDTO {

    private String usuario;
    private String rol;
    private OffsetDateTime expiraEn;

}
