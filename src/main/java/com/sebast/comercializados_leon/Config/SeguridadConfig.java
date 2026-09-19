package com.sebast.comercializados_leon.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

import com.sebast.comercializados_leon.Repository.SesionRepository;
import com.sebast.comercializados_leon.Security.EscritorDeErrores;
import com.sebast.comercializados_leon.Security.LimitadorDePeticiones;
import com.sebast.comercializados_leon.Security.LimitePorIpFilter;
import com.sebast.comercializados_leon.Security.LimitePorUsuarioFilter;
import com.sebast.comercializados_leon.Security.TamanoPeticionFilter;
import com.sebast.comercializados_leon.Security.TokenAutenticacionFilter;

import jakarta.servlet.DispatcherType;

// Reglas de acceso de toda la API.
//
// Orden de los filtros en cada peticion:
//   CORS -> limite por IP -> tamano del cuerpo -> token -> limite por usuario -> reglas de acceso
//
// Todo exige una sesion de admin, excepto el login. Un endpoint nuevo queda protegido
// automaticamente sin tocar nada aqui.
@Configuration
@EnableWebSecurity
public class SeguridadConfig {

    @Bean
    public SecurityFilterChain cadenaDeSeguridad(HttpSecurity http,
                                                 SesionRepository sesionRepository,
                                                 LimitadorDePeticiones limitador,
                                                 EscritorDeErrores errores) throws Exception {
        // Se crean aqui (y no como @Component) para que Spring Boot no los registre
        // ademas como filtros sueltos del servidor y se ejecuten dos veces.
        var limitePorIp = new LimitePorIpFilter(limitador, errores);
        var tamanoPeticion = new TamanoPeticionFilter(errores);
        var token = new TokenAutenticacionFilter(sesionRepository, errores);
        var limitePorUsuario = new LimitePorUsuarioFilter(limitador, errores);

        http
                // Usa el bean "corsConfigurationSource" de Config/CorsConfig.
                .cors(Customizer.withDefaults())
                // CSRF no aplica: no hay cookies de sesion. El token viaja en la cabecera
                // Authorization, que un sitio ajeno no puede hacer que el navegador envie.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .requestCache(cache -> cache.disable())
                .headers(h -> h
                        // La API solo devuelve JSON: nada de scripts, estilos ni iframes.
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(ref -> ref.policy(ReferrerPolicy.NO_REFERRER)))
                .authorizeHttpRequests(reglas -> reglas
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .anyRequest().hasRole("ADMIN"))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
                            errores.escribir(response, HttpStatus.UNAUTHORIZED,
                                    "Sesión inválida o vencida. Inicia sesión de nuevo.");
                        })
                        .accessDeniedHandler((request, response, ex) ->
                                errores.escribir(response, HttpStatus.FORBIDDEN, "No tienes permiso para hacer esto.")))
                .addFilterBefore(token, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(tamanoPeticion, TokenAutenticacionFilter.class)
                .addFilterBefore(limitePorIp, TamanoPeticionFilter.class)
                .addFilterAfter(limitePorUsuario, TokenAutenticacionFilter.class);

        return http.build();
    }
}
