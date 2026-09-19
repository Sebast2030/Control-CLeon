package com.sebast.comercializados_leon.Controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sebast.comercializados_leon.Model.Dto.ClienteDTO;
import com.sebast.comercializados_leon.Service.ClienteService;
import com.sebast.comercializados_leon.Util.Sanitizador;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// El CORS se configura globalmente en Config/CorsConfig.
@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;

    @GetMapping
    public List<ClienteDTO> listar(
            @RequestParam(required = false)
            @Size(max = 100, message = "La busqueda no puede superar 100 caracteres")
            @Pattern(regexp = Sanitizador.TEXTO, message = "La busqueda tiene caracteres no permitidos")
            String nombre){
        if (nombre != null && !nombre.isBlank()){
            return clienteService.buscarPorNombre(nombre);
        }
        return clienteService.listarTodos();

    }

    // Apartado especial de clientes destacados (top compradores)
    @GetMapping("/destacados")
    public List<ClienteDTO> listarDestacados() {
        return clienteService.listarDestacados();
    }

    @GetMapping("/{id}")
    public ClienteDTO obtener(@PathVariable @Positive(message = "Id invalido") Long id) {
        return clienteService.obtenerPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClienteDTO crear(@Valid @RequestBody ClienteDTO clienteDTO) {
        return clienteService.crear(clienteDTO);
    }

    @PutMapping("/{id}")
    public ClienteDTO actualizar(@PathVariable @Positive(message = "Id invalido") Long id,
                                 @Valid @RequestBody ClienteDTO clienteDTO) {
        return clienteService.actualizar(id, clienteDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable @Positive(message = "Id invalido") Long id){
        clienteService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
