package com.sebast.comercializados_leon.Exception;

// Usuario inexistente, contrasena incorrecta o usuario desactivado: siempre el mismo
// mensaje, para no revelar cual de las tres fue.
public class CredencialesInvalidasException extends RuntimeException {
    public CredencialesInvalidasException() {
        super("Usuario o contraseña incorrectos.");
    }
}
