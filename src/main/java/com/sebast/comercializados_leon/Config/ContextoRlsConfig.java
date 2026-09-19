package com.sebast.comercializados_leon.Config;

import javax.sql.DataSource;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.sebast.comercializados_leon.Security.ContextoRlsDataSource;

// Envuelve el DataSource que crea Spring Boot (el pool Hikari) con ContextoRlsDataSource,
// asi TODAS las conexiones (JPA, JdbcClient) llevan el token de la sesion para RLS.
@Configuration
public class ContextoRlsConfig {

    // static: los BeanPostProcessor se crean antes que el resto de beans.
    @Bean
    public static BeanPostProcessor contextoRlsEnDataSource() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String nombreBean) {
                if (bean instanceof DataSource dataSource && !(bean instanceof ContextoRlsDataSource)) {
                    return new ContextoRlsDataSource(dataSource);
                }
                return bean;
            }
        };
    }
}
