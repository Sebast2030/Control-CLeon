package com.sebast.comercializados_leon.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;

import com.sebast.comercializados_leon.Model.Dto.ProductoDTO;
import com.sebast.comercializados_leon.Service.ProductoService;
import com.sebast.comercializados_leon.Util.Sanitizador;


// El CORS se configura globalmente en Config/CorsConfig.
@RestController
@RequestMapping("/api/productos")
@RequiredArgsConstructor
public class ProductoController {

    private final ProductoService productoService;

    @GetMapping
    public List<ProductoDTO> listar(
            @RequestParam(required = false)
            @Size(max = 100, message = "La busqueda no puede superar 100 caracteres")
            @Pattern(regexp = Sanitizador.TEXTO, message = "La busqueda tiene caracteres no permitidos")
            String q,
            @RequestParam(required = false) @Size(max = 30, message = "Categoria invalida") String categoria,
            @RequestParam(required = false) @Size(max = 30, message = "Marca invalida") String marca
    ) {
        return productoService.listar(q, categoria, marca);
    }

    // Sin "minimo" se usa el umbral por defecto definido en ProductoService.
    @GetMapping("/stock-bajo")
    public List<ProductoDTO> listarConStockBajo(
            @RequestParam(required = false)
            @Min(value = 0, message = "El minimo no puede ser negativo")
            @Max(value = 1_000_000, message = "El minimo es demasiado grande")
            Integer minimo) {
        return productoService.listarConStockBajo(minimo);
    }

    // Opciones fijas para los menus desplegables de categoria y marca en el frontend,
    // mas el umbral de stock bajo para que el frontend no lo repita por su cuenta.
    @GetMapping("/opciones")
    public Map<String, Object> opciones() {
        return Map.of(
                "categorias", productoService.categoriasDisponibles(),
                "marcas", productoService.marcasDisponibles(),
                "stockBajo", ProductoService.STOCK_BAJO_POR_DEFECTO
        );
    }

    @GetMapping("/{id}")
    public ProductoDTO obtener(@PathVariable @Positive(message = "Id invalido") Long id) {
        return productoService.obtenerPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoDTO crear(@Valid @RequestBody ProductoDTO productoDTO) {
        return productoService.crear(productoDTO);
    }

    @PutMapping("/{id}")
    public ProductoDTO actualizar(@PathVariable @Positive(message = "Id invalido") Long id,
                                  @Valid @RequestBody ProductoDTO productoDTO) {
        return productoService.actualizar(id, productoDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable @Positive(message = "Id invalido") Long id) {
        productoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
