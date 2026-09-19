package com.sebast.comercializados_leon.Service;

import org.springframework.stereotype.Service;

import com.sebast.comercializados_leon.Exception.CredencialesInvalidasException;
import com.sebast.comercializados_leon.Exception.CuentaBloqueadaException;
import com.sebast.comercializados_leon.Model.Dto.LoginRequest;
import com.sebast.comercializados_leon.Model.Dto.LoginResponse;
import com.sebast.comercializados_leon.Model.Dto.SesionDTO;
import com.sebast.comercializados_leon.Repository.SesionRepository;
import com.sebast.comercializados_leon.Repository.SesionRepository.ResultadoLogin;
import com.sebast.comercializados_leon.Security.UsuarioAutenticado;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// A diferencia de los demas services, este NO es @Transactional a proposito: un login
// fallido lanza una excepcion, y dentro de una transaccion eso desharia el conteo de
// intentos fallidos que guarda la base, dejando la puerta abierta a fuerza bruta.
// Cada llamada a SesionRepository es una sola funcion de la base y ya es atomica.
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SesionRepository sesionRepository;

    public LoginResponse iniciarSesion(LoginRequest request, String ip) {
        ResultadoLogin resultado = sesionRepository.iniciarSesion(request.getUsuario(), request.getPassword(), ip);

        switch (resultado.resultado()) {
            case "OK" -> {
                log.info("Inicio de sesion de '{}' desde {}", resultado.usuario(), ip);
                return new LoginResponse(resultado.token(), resultado.usuario(), resultado.expiraEn());
            }
            case "BLOQUEADO" -> {
                log.warn("Intento de inicio de sesion con la cuenta '{}' bloqueada, desde {}", request.getUsuario(), ip);
                throw new CuentaBloqueadaException(resultado.bloqueadoHasta());
            }
            default -> {
                // El usuario ya paso por @Pattern (sin saltos de linea): no puede falsear el log.
                log.warn("Inicio de sesion fallido para '{}' desde {}", request.getUsuario(), ip);
                throw new CredencialesInvalidasException();
            }
        }
    }

    public SesionDTO sesionActual(UsuarioAutenticado usuario) {
        return new SesionDTO(usuario.usuario(), usuario.rol(), usuario.expiraEn());
    }

    public void cerrarSesion(UsuarioAutenticado usuario) {
        sesionRepository.cerrar(usuario.token());
        log.info("Cierre de sesion de '{}'", usuario.usuario());
    }
}
