package com.sebast.comercializados_leon.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sebast.comercializados_leon.Exception.ResourceNotFoundException;
import com.sebast.comercializados_leon.Model.Dto.ProductoDTO;
import com.sebast.comercializados_leon.Model.Entity.Producto;
import com.sebast.comercializados_leon.Repository.ProductoRepository;
import com.sebast.comercializados_leon.Util.Sanitizador;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductoService {

    private final ProductoRepository productoRepository;

    // ---- Listas fijas permitidas (se muestran como menu desplegable en el frontend) ----
    // El orden aqui define el orden en que aparecen en los selects.
    private static final Map<String, String> CATEGORIA_LETRA = new LinkedHashMap<>();
    static {
        CATEGORIA_LETRA.put("Silenciador", "S");
        CATEGORIA_LETRA.put("Catalizador", "C");
        CATEGORIA_LETRA.put("Puntera", "P");
        CATEGORIA_LETRA.put("Resonador", "R");
        CATEGORIA_LETRA.put("Tuberia", "T");
    }

    private static final List<String> MARCAS_VALIDAS = List.of("Cleon", "TMP", "Servitec", "Generico");
    private static final String MARCA_CLEON = "Cleon";
    private static final int MAX_CONSECUTIVO = 9999;

    // Unidades o menos a partir de las cuales un producto cuenta como "stock bajo".
    // Es la unica definicion del umbral: el frontend la lee desde /api/productos/opciones.
    public static final int STOCK_BAJO_POR_DEFECTO = 5;

    public List<String> categoriasDisponibles() {
        return List.copyOf(CATEGORIA_LETRA.keySet());
    }

    public List<String> marcasDisponibles() {
        return MARCAS_VALIDAS;
    }

    // ---- Listado con filtros opcionales, siempre ordenado por codigo ----
    // La categoria y la marca tienen que ser de las listas fijas (si no, 400). La busqueda
    // se escapa para que un % o un _ escritos por el usuario se busquen como texto.
    public List<ProductoDTO> listar(String q, String categoria, String marca) {
        String busqueda = normalizarFiltro(q);
        String categoriaFiltro = normalizarFiltro(categoria);
        String marcaFiltro = normalizarFiltro(marca);
        return productoRepository.buscarConFiltros(
                        Sanitizador.escaparLike(busqueda),
                        categoriaFiltro == null ? null : normalizarCategoria(categoriaFiltro),
                        marcaFiltro == null ? null : normalizarMarca(marcaFiltro)).stream()
                .map(this::aDTO)
                .toList();
    }

    public ProductoDTO obtenerPorId(Long id) {
        return aDTO(buscarEntidad(id));
    }

    public List<ProductoDTO> listarConStockBajo(Integer stockMaximo) {
        int limite = stockMaximo != null ? stockMaximo : STOCK_BAJO_POR_DEFECTO;
        return productoRepository.findByStockLessThanEqualOrderByCodigoAsc(limite).stream()
                .map(this::aDTO)
                .toList();
    }

    public ProductoDTO crear(ProductoDTO dto) {
        String categoria = normalizarCategoria(dto.getCategoria());
        String marca = normalizarMarca(dto.getMarca());

        Producto producto = new Producto();
        producto.setCodigo(generarCodigo(categoria, marca));
        producto.setNombre(dto.getNombre());
        producto.setCategoria(categoria);
        producto.setPrecio(dto.getPrecio());
        producto.setStock(dto.getStock());
        producto.setMarca(marca);

        return aDTO(productoRepository.save(producto));
    }

    // El codigo NO se puede editar: se fija al crear el producto y se mantiene igual,
    // incluso si mas adelante cambias la categoria o la marca del producto.
    public ProductoDTO actualizar(Long id, ProductoDTO dto) {
        Producto producto = buscarEntidad(id);
        producto.setNombre(dto.getNombre());
        producto.setCategoria(normalizarCategoria(dto.getCategoria()));
        producto.setPrecio(dto.getPrecio());
        producto.setStock(dto.getStock());
        producto.setMarca(normalizarMarca(dto.getMarca()));
        return aDTO(productoRepository.save(producto));
    }

    public void eliminar(Long id) {
        if (!productoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Producto no encontrado con id: " + id);
        }
        productoRepository.deleteById(id);
    }

    // ---- usado por FacturaService ----
    protected Producto buscarEntidad(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con id: " + id));
    }

    // ---- generacion de codigo ----

    private String generarCodigo(String categoria, String marca) {
        String letraCategoria = CATEGORIA_LETRA.get(categoria);
        String letraMarca = MARCA_CLEON.equalsIgnoreCase(marca) ? "C" : "G";
        String prefijo = letraCategoria + letraMarca;

        int siguiente = productoRepository.findByCodigoStartingWithIgnoreCase(prefijo + "-").stream()
                .map(p -> extraerNumero(p.getCodigo(), prefijo))
                .max(Comparator.naturalOrder())
                .orElse(0) + 1;

        if (siguiente > MAX_CONSECUTIVO) {
            throw new IllegalArgumentException(
                    "Se alcanzo el maximo de codigos (" + MAX_CONSECUTIVO + ") para el prefijo " + prefijo);
        }

        return prefijo + "-" + String.format("%04d", siguiente);
    }

    private int extraerNumero(String codigo, String prefijo) {
        try {
            String parte = codigo.substring(prefijo.length() + 1); // +1 por el guion
            return Integer.parseInt(parte);
        } catch (Exception e) {
            return 0; // codigo con formato distinto (ej. datos viejos), se ignora para el conteo
        }
    }

    // Un filtro vacio o en blanco equivale a "no filtrar": la consulta espera null.
    private String normalizarFiltro(String valor) {
        return Sanitizador.limpiar(valor);
    }

    private String normalizarCategoria(String valor) {
        return CATEGORIA_LETRA.keySet().stream()
                .filter(c -> c.equalsIgnoreCase(valor))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Categoria invalida. Debe ser una de: " + String.join(", ", CATEGORIA_LETRA.keySet())));
    }

    private String normalizarMarca(String valor) {
        return MARCAS_VALIDAS.stream()
                .filter(m -> m.equalsIgnoreCase(valor))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Marca invalida. Debe ser una de: " + String.join(", ", MARCAS_VALIDAS)));
    }

    // ---- mapeo entidad -> DTO ----

    private ProductoDTO aDTO(Producto producto) {
        return new ProductoDTO(
                producto.getId(),
                producto.getCodigo(),
                producto.getNombre(),
                producto.getCategoria(),
                producto.getPrecio(),
                producto.getStock(),
                producto.getMarca()
        );
    }
}
