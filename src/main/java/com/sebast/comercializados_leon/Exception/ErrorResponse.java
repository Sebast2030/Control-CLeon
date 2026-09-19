package com.sebast.comercializados_leon.Exception;

import java.time.LocalDateTime;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime timestamp = LocalDateTime.now();

    private int status;
    private String mensaje;
    private Map<String, String> errores; // usado en errores de validacion (campo -> mensaje)

    public ErrorResponse(int status, String mensaje) {
        this.timestamp = LocalDateTime.now();
        this.status = status;
        this.mensaje = mensaje;
    }

}
