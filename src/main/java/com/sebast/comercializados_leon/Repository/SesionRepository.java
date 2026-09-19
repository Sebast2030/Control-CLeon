package com.sebast.comercializados_leon.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.sebast.comercializados_leon.Security.UsuarioAutenticado;

import lombok.RequiredArgsConstructor;

// Acceso a usuarios y sesiones. No usa Spring Data JPA porque cleon_app no tiene
// permiso para leer esas tablas: todo pasa por las funciones de db/seguridad.sql,
// que verifican la contrasena y manejan los tokens dentro de la base.
//
// Todos los valores van como parametros enlazados (:nombre), nunca concatenados.
@Repository
@RequiredArgsConstructor
public class SesionRepository {

    private final JdbcClient jdbcClient;

    // resultado: OK | CREDENCIALES_INVALIDAS | BLOQUEADO
    public record ResultadoLogin(String resultado, String token, String usuario, String rol,
                                 OffsetDateTime expiraEn, OffsetDateTime bloqueadoHasta) {

        @Override
        public String toString() {
            return "ResultadoLogin[resultado=" + resultado + ", usuario=" + usuario + "]";
        }
    }

    public ResultadoLogin iniciarSesion(String usuario, String password, String ip) {
        return jdbcClient.sql("SELECT * FROM cleon_iniciar_sesion(:usuario, :password, :ip)")
                .param("usuario", usuario)
                .param("password", password)
                .param("ip", ip)
                .query((rs, fila) -> new ResultadoLogin(
                        rs.getString("resultado"),
                        rs.getString("token"),
                        rs.getString("usuario"),
                        rs.getString("rol"),
                        rs.getObject("expira_en", OffsetDateTime.class),
                        rs.getObject("bloqueado_hasta", OffsetDateTime.class)))
                .single();
    }

    // Vacio si el token no existe, esta vencido, se cerro o el usuario fue desactivado.
    public Optional<UsuarioAutenticado> validar(String token) {
        return jdbcClient.sql("SELECT * FROM cleon_validar_sesion(:token)")
                .param("token", token)
                .query((rs, fila) -> new UsuarioAutenticado(
                        rs.getLong("usuario_id"),
                        rs.getString("usuario"),
                        rs.getString("rol"),
                        rs.getObject("expira_en", OffsetDateTime.class),
                        token))
                .optional();
    }

    public void cerrar(String token) {
        jdbcClient.sql("SELECT cleon_cerrar_sesion(:token)")
                .param("token", token)
                .query()
                .listOfRows();
    }
}
