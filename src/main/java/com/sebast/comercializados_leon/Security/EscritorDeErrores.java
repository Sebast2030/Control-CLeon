package com.sebast.comercializados_leon.Security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.sebast.comercializados_leon.Exception.ErrorResponse;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import tools.jackson.databind.json.JsonMapper;

// Los filtros de seguridad corren antes que los controllers, asi que sus errores no
// pasan por GlobalExceptionHandler. Esta clase los responde con el mismo formato JSON
// (ErrorResponse) para que el frontend los muestre igual que cualquier otro error.
@Component
@RequiredArgsConstructor
public class EscritorDeErrores {

    private final JsonMapper jsonMapper;

    public void escribir(HttpServletResponse response, HttpStatus status, String mensaje) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        jsonMapper.writeValue(response.getOutputStream(), new ErrorResponse(status.value(), mensaje));
    }

    // 429 con la cabecera estandar Retry-After (segundos a esperar).
    public void escribirLimiteExcedido(HttpServletResponse response, long segundos, String mensaje) throws IOException {
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(segundos));
        escribir(response, HttpStatus.TOO_MANY_REQUESTS, mensaje);
    }
}
