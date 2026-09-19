package com.sebast.comercializados_leon.Exception;

import java.time.Duration;
import java.time.OffsetDateTime;

import lombok.Getter;

// La cuenta quedo bloqueada temporalmente por demasiados intentos fallidos.
@Getter
public class CuentaBloqueadaException extends RuntimeException {

    private final long segundosRestantes;

    public CuentaBloqueadaException(OffsetDateTime bloqueadoHasta) {
        super("Demasiados intentos fallidos. El acceso queda bloqueado unos minutos; intenta de nuevo más tarde.");
        long segundos = bloqueadoHasta == null ? 60 : Duration.between(OffsetDateTime.now(), bloqueadoHasta).toSeconds();
        this.segundosRestantes = Math.max(1, segundos);
    }
}
