package com.sebast.comercializados_leon.Security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sebast.comercializados_leon.Repository.SesionRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// Lee "Authorization: Bearer <token>", lo valida contra la base y, si es una sesion
// vigente, deja al usuario autenticado para el resto de la peticion.
//
// Si no hay token o no es valido, NO responde nada aqui: la peticion sigue sin
// autenticar y la regla de SeguridadConfig la rechaza con 401.
@Slf4j
@RequiredArgsConstructor
public class TokenAutenticacionFilter extends OncePerRequestFilter {

    private static final String PREFIJO = "Bearer ";
    // Los tokens son 32 bytes aleatorios en hexadecimal (ver cleon_iniciar_sesion).
    private static final Pattern FORMATO_TOKEN = Pattern.compile("^[0-9a-f]{64}$");

    private final SesionRepository sesionRepository;
    private final EscritorDeErrores errores;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = extraerToken(request);
        if (token != null) {
            Optional<UsuarioAutenticado> usuario;
            try {
                usuario = sesionRepository.validar(token);
            } catch (DataAccessException e) {
                log.error("No se pudo validar la sesion contra la base de datos", e);
                errores.escribir(response, HttpStatus.SERVICE_UNAVAILABLE,
                        "No se pudo verificar la sesión. Intenta de nuevo en unos segundos.");
                return;
            }
            usuario.ifPresent(TokenAutenticacionFilter::autenticar);
        }
        chain.doFilter(request, response);
    }

    private static void autenticar(UsuarioAutenticado usuario) {
        var autenticacion = UsernamePasswordAuthenticationToken.authenticated(
                usuario, null, List.of(new SimpleGrantedAuthority("ROLE_" + usuario.rol())));
        SecurityContextHolderStrategy estrategia = SecurityContextHolder.getContextHolderStrategy();
        SecurityContext contexto = estrategia.createEmptyContext();
        contexto.setAuthentication(autenticacion);
        estrategia.setContext(contexto);
    }

    // Cualquier cosa que no tenga el formato exacto se descarta sin consultar la base.
    private static String extraerToken(HttpServletRequest request) {
        String cabecera = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (cabecera == null || !cabecera.startsWith(PREFIJO)) {
            return null;
        }
        String token = cabecera.substring(PREFIJO.length()).strip();
        return FORMATO_TOKEN.matcher(token).matches() ? token : null;
    }
}
