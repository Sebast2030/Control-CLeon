package com.sebast.comercializados_leon.Controller;

import com.sebast.comercializados_leon.Model.Dto.FacturaCreateRequest;
import com.sebast.comercializados_leon.Model.Dto.FacturaDTO;
import com.sebast.comercializados_leon.Service.FacturaService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;


// El CORS se configura globalmente en Config/CorsConfig.
@RestController
@RequestMapping("/api/facturas")
@RequiredArgsConstructor
public class FacturaController {

    private final FacturaService facturaService;

    // estado y ordenarPor ademas se validan contra su lista de valores en FacturaService.
    @GetMapping
    public List<FacturaDTO> listar(
            @RequestParam(required = false) @Positive(message = "Cliente invalido") Long clienteId,
            @RequestParam(required = false) @Size(max = 20, message = "Estado invalido") String estado,
            @RequestParam(required = false) @Size(max = 20, message = "Orden invalido") String ordenarPor
    ) {
        return facturaService.listarFiltradas(estado, clienteId, ordenarPor);
    }

    @GetMapping("/{id}")
    public FacturaDTO obtener(@PathVariable @Positive(message = "Id invalido") Long id) {
        return facturaService.obtenerPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FacturaDTO crear(@Valid @RequestBody FacturaCreateRequest request) {
        return facturaService.crear(request);
    }

    @PutMapping("/{id}/pagar")
    public FacturaDTO pagar(@PathVariable @Positive(message = "Id invalido") Long id) {
        return facturaService.pagar(id);
    }

    @PutMapping("/{id}/anular")
    public FacturaDTO anular(@PathVariable @Positive(message = "Id invalido") Long id) {
        return facturaService.anular(id);
    }
}
