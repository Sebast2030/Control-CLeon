package com.sebast.comercializados_leon.Security;

import java.io.IOException;

import org.springframework.http.HttpMethod;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.Resultado;
import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.TipoLimite;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

// Primer control de la cadena: limita las peticiones por IP ANTES de validar el token,
// para que una avalancha de peticiones no llegue ni a consultar la base de datos.
// El login tiene ademas su propio limite, mucho mas estricto.
@RequiredArgsConstructor
public class LimitePorIpFilter extends OncePerRequestFilter {

    private static final RequestMatcher LOGIN =
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/login");

    private final LimitadorDePeticiones limitador;
    private final EscritorDeErrores errores;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // IP real de la conexion. No se usa X-Forwarded-For: no hay proxy delante y esa
        // cabecera la puede inventar cualquiera para saltarse el limite.
        String ip = request.getRemoteAddr();

        Resultado resultado = limitador.consumir(TipoLimite.IP, ip);
        if (!resultado.permitido()) {
            errores.escribirLimiteExcedido(response, resultado.segundosDeEspera(),
                    "Demasiadas peticiones desde este dispositivo. Espera " + resultado.segundosDeEspera()
                            + " segundos e intenta de nuevo.");
            return;
        }

        if (LOGIN.matches(request)) {
            resultado = limitador.consumir(TipoLimite.LOGIN, ip);
            if (!resultado.permitido()) {
                errores.escribirLimiteExcedido(response, resultado.segundosDeEspera(),
                        "Demasiados intentos de inicio de sesión. Espera " + resultado.segundosDeEspera()
                                + " segundos e intenta de nuevo.");
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
