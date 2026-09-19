package com.sebast.comercializados_leon.Security;

import java.io.Closeable;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

// Pone en cada conexion a PostgreSQL el token de la sesion que hace la peticion
// (variable cleon.token). Las politicas RLS de db/seguridad.sql solo muestran o dejan
// modificar datos si ese token es de una sesion de admin vigente.
//
// Si una consulta se ejecuta sin sesion autenticada (un endpoint mal configurado, un
// camino que se salto el login, una tarea en segundo plano), la variable queda vacia y
// la base no devuelve ni modifica nada: falla cerrado.
public class ContextoRlsDataSource extends DelegatingDataSource implements Closeable {

    // false = vale para toda la conexion y no solo para una transaccion, porque aqui
    // todavia no empezo ninguna. Se sobrescribe cada vez que una conexion sale del pool,
    // asi que nunca queda el token de una peticion anterior.
    private static final String SQL = "SELECT set_config('cleon.token', ?, false)";

    public ContextoRlsDataSource(DataSource destino) {
        super(destino);
    }

    @Override
    public Connection getConnection() throws SQLException {
        return aplicarContexto(super.getConnection());
    }

    @Override
    public Connection getConnection(String usuario, String password) throws SQLException {
        return aplicarContexto(super.getConnection(usuario, password));
    }

    // Spring cierra el pool (Hikari) al apagar o reiniciar la app a traves de este metodo.
    // Sin el, cada reinicio de devtools dejaria conexiones abiertas.
    @Override
    public void close() throws IOException {
        if (getTargetDataSource() instanceof Closeable pool) {
            pool.close();
        }
    }

    private static Connection aplicarContexto(Connection conexion) throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(SQL)) {
            sentencia.setString(1, tokenDeLaPeticionActual());
            sentencia.execute();
            // Si la conexion ya viniera dentro de una transaccion, un rollback posterior
            // desharia el set_config: se confirma de inmediato.
            if (!conexion.getAutoCommit()) {
                conexion.commit();
            }
            return conexion;
        } catch (SQLException | RuntimeException e) {
            conexion.close();
            throw e;
        }
    }

    private static String tokenDeLaPeticionActual() {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion != null && autenticacion.getPrincipal() instanceof UsuarioAutenticado usuario) {
            return usuario.token();
        }
        return "";
    }
}
