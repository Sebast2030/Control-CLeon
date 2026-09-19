package com.sebast.comercializados_leon.Controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.sebast.comercializados_leon.Model.Dto.LoginRequest;
import com.sebast.comercializados_leon.Model.Dto.LoginResponse;
import com.sebast.comercializados_leon.Model.Dto.SesionDTO;
import com.sebast.comercializados_leon.Security.UsuarioAutenticado;
import com.sebast.comercializados_leon.Service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

// Solo /login es publico (ver Config/SeguridadConfig); los demas exigen sesion.
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return authService.iniciarSesion(request, http.getRemoteAddr());
    }

    // Quien esta conectado. El frontend lo usa al abrir la pagina para saber si el
    // token guardado sigue sirviendo.
    @GetMapping("/sesion")
    public SesionDTO sesion(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return authService.sesionActual(usuario);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        authService.cerrarSesion(usuario);
    }
}
