package com.sebast.comercializados_leon.Config;

import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

// Desde que paginas se puede llamar a la API. Lo aplica SeguridadConfig.
@Configuration
public class CorsConfig {

    // Expresion regular EXACTA (con ^ y $) de los origenes permitidos, definida en
    // cleon.cors.origenes:
    //   - en el PC (application.properties): Live Server por HTTPS en la red 192.168.x.x
    //   - en produccion (application-prod.properties): la direccion de Cloudflare Pages
    // Se usa una expresion y no comodines tipo "*", que dejarian pasar dominios como
    // 192.168.1.sitio-malicioso.com.
    private final Pattern origenesPermitidos;

    public CorsConfig(@Value("${cleon.cors.origenes}") String origenes) {
        if (!origenes.startsWith("^") || !origenes.endsWith("$")) {
            throw new IllegalStateException(
                    "cleon.cors.origenes debe ser una expresion exacta que empiece con ^ y termine con $");
        }
        this.origenesPermitidos = Pattern.compile(origenes);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration() {
            @Override
            public String checkOrigin(String origen) {
                return origen != null && origenesPermitidos.matcher(origen).matches() ? origen : null;
            }
        };
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));
        config.setExposedHeaders(List.of(HttpHeaders.RETRY_AFTER));
        // El token viaja en una cabecera, no en cookies: no hace falta enviar credenciales.
        config.setAllowCredentials(false);
        config.setMaxAge(Duration.ofMinutes(30));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
