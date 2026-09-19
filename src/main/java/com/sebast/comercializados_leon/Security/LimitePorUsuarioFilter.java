package com.sebast.comercializados_leon.Security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.Resultado;
import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.TipoLimite;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

// Limite por usuario autenticado. Va despues de TokenAutenticacionFilter (necesita
// saber quien es) y cubre el caso de alguien que reparte las peticiones entre varias
// IPs usando la misma sesion.
@RequiredArgsConstructor
public class LimitePorUsuarioFilter extends OncePerRequestFilter {

    private final LimitadorDePeticiones limitador;
    private final EscritorDeErrores errores;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion != null && autenticacion.getPrincipal() instanceof UsuarioAutenticado usuario) {
            Resultado resultado = limitador.consumir(TipoLimite.USUARIO, String.valueOf(usuario.id()));
            if (!resultado.permitido()) {
                errores.escribirLimiteExcedido(response, resultado.segundosDeEspera(),
                        "Demasiadas peticiones con este usuario. Espera " + resultado.segundosDeEspera()
                                + " segundos e intenta de nuevo.");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
