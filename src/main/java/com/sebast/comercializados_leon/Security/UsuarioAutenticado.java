package com.sebast.comercializados_leon.Security;

import java.security.Principal;
import java.time.OffsetDateTime;

// Usuario de la peticion en curso, una vez validado su token contra la base.
// Se guarda en el SecurityContext de Spring durante la peticion.
//
// El token se conserva porque ContextoRlsDataSource lo pone en cada conexion a
// PostgreSQL para que las politicas RLS dejen ver los datos.
public record UsuarioAutenticado(Long id, String usuario, String rol, OffsetDateTime expiraEn, String token)
        implements Principal {

    @Override
    public String getName() {
        return usuario;
    }

    // Sin el token, para que nunca termine en un log.
    @Override
    public String toString() {
        return "UsuarioAutenticado[id=" + id + ", usuario=" + usuario + ", rol=" + rol + "]";
    }
}
