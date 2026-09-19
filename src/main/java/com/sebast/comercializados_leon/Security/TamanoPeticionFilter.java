package com.sebast.comercializados_leon.Security;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

// Rechaza cuerpos demasiado grandes antes de leerlos. La API solo recibe JSON
// pequenos (el mas grande, una factura de 100 lineas, pesa unos pocos KB).
// Si el cuerpo llega sin Content-Length, lo corta el limite de Jackson
// (spring.jackson.factory.constraints.read.max-document-length), que es el mismo.
@RequiredArgsConstructor
public class TamanoPeticionFilter extends OncePerRequestFilter {

    static final long MAXIMO_BYTES = 64 * 1024;

    private final EscritorDeErrores errores;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > MAXIMO_BYTES) {
            errores.escribir(response, HttpStatus.CONTENT_TOO_LARGE, "La petición es demasiado grande.");
            return;
        }
        chain.doFilter(request, response);
    }
}
