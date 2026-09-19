package com.sebast.comercializados_leon.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sebast.comercializados_leon.Exception.ResourceNotFoundException;
import com.sebast.comercializados_leon.Exception.StockInsuficienteException;
import com.sebast.comercializados_leon.Model.Dto.EntradaStockRequest;
import com.sebast.comercializados_leon.Model.Dto.ProductoDTO;
import com.sebast.comercializados_leon.Model.Dto.TrasladoRequest;
import com.sebast.comercializados_leon.Model.Entity.Almacen;
import com.sebast.comercializados_leon.Model.Entity.OrigenVenta;
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
        CATEGORIA_LETRA.put("Flexible", "F");
        CATEGORIA_LETRA.put("Otros", "O");
    }

    // Cleon primero, Generico al final y el resto en orden alfabetico.
    private static final List<String> MARCAS_VALIDAS = List.of("Cleon", "MG", "Servitec", "TMP", "UMO", "Generico");
    private static final String MARCA_CLEON = "Cleon";
    private static final int MAX_CONSECUTIVO = 9999;

    // Unidades o menos a partir de las cuales un producto cuenta como "stock bajo".
    // Es la unica definicion del umbral: el frontend la lee desde /api/productos/opciones.
    public static final int STOCK_BAJO_POR_DEFECTO = 5;

    // ---- Listas de precios ----
    // Nivel 1: el precio con el que se crea el producto.
    // Nivel 2: el nivel 1 mas este porcentaje, redondeado al peso.
    // Nivel 3: precio libre, se escribe en cada factura (clientes que instalan).
    // Es la unica definicion del recargo: el frontend lo lee desde /api/productos/opciones.
    public static final int RECARGO_NIVEL_2 = 10;
    public static final int NIVEL_PRECIO_LIBRE = 3;

    // Tope de unidades en cualquiera de los tres inventarios (igual que el del DTO).
    private static final int MAX_UNIDADES = 1_000_000;

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

    // Un producto creado desde la bodega llega con stock 0 y sus unidades en stockBodega.
    // El camion siempre arranca vacio: se carga con traslados desde el general.
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
        producto.setStockCamion(0);
        producto.setStockBodega(dto.getStockBodega() != null ? dto.getStockBodega() : 0);

        return aDTO(productoRepository.save(producto));
    }

    // El codigo NO se puede editar: se fija al crear el producto y se mantiene igual,
    // incluso si mas adelante cambias la categoria o la marca del producto.
    // Lo del camion no se edita aqui (solo con traslados), y el stock general no puede
    // quedar por debajo de lo que va cargado en el camion.
    public ProductoDTO actualizar(Long id, ProductoDTO dto) {
        Producto producto = buscarParaActualizar(id);
        if (dto.getStock() < producto.getStockCamion()) {
            throw new IllegalArgumentException("El stock general no puede quedar en " + dto.getStock()
                    + ": hay " + producto.getStockCamion() + " unidades cargadas en el camion, que hacen parte de el. "
                    + "Primero devuelvelas o traspasalas.");
        }
        producto.setNombre(dto.getNombre());
        producto.setCategoria(normalizarCategoria(dto.getCategoria()));
        producto.setPrecio(dto.getPrecio());
        producto.setStock(dto.getStock());
        producto.setMarca(normalizarMarca(dto.getMarca()));
        if (dto.getStockBodega() != null) {
            producto.setStockBodega(dto.getStockBodega());
        }
        return aDTO(productoRepository.save(producto));
    }

    // Suma unidades nuevas (llego mercancia) al general o a la bodega, sin tocar nada mas
    // del producto. Al camion no: se carga con un traslado desde el general.
    public ProductoDTO agregarUnidades(Long id, EntradaStockRequest request) {
        Producto producto = buscarParaActualizar(id);
        int cantidad = request.getCantidad();
        switch (request.getAlmacen()) {
            case GENERAL -> producto.setStock(sumarConTope(producto.getStock(), cantidad, "del inventario general"));
            case BODEGA -> producto.setStockBodega(sumarConTope(producto.getStockBodega(), cantidad, "de la bodega"));
            case CAMION -> throw new IllegalArgumentException(
                    "Al camion no se le agregan unidades nuevas: se cargan desde el inventario general con un traslado.");
        }
        return aDTO(productoRepository.save(producto));
    }

    // Mueve unidades entre el local (GENERAL), el camion y la bodega.
    //   El stock general incluye lo del camion, asi que GENERAL <-> CAMION solo cambia
    //   stock_camion (el total no se mueve). Todo lo que entra o sale de la bodega si
    //   cambia el stock general, porque la bodega va aparte.
    public ProductoDTO trasladar(Long id, TrasladoRequest request) {
        Almacen origen = request.getOrigen();
        Almacen destino = request.getDestino();
        if (origen == destino) {
            throw new IllegalArgumentException("El origen y el destino del traslado tienen que ser distintos.");
        }

        Producto producto = buscarParaActualizar(id);
        int cantidad = request.getCantidad();
        int disponible = disponibleEn(producto, origen);
        if (disponible < cantidad) {
            throw new StockInsuficienteException("No hay suficientes unidades de \"" + producto.getNombre() + "\" en "
                    + nombreAlmacen(origen) + ". Disponible: " + disponible + ", solicitado: " + cantidad);
        }

        quitarDe(producto, origen, cantidad);
        ponerEn(producto, destino, cantidad);
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

    // Igual que buscarEntidad, pero bloqueando la fila hasta el final de la transaccion.
    // Todo lo que cambia el stock pasa por aqui.
    protected Producto buscarParaActualizar(Long id) {
        return productoRepository.buscarParaActualizar(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con id: " + id));
    }

    // Precio de venta segun la lista de precios del cliente (1 o 2). El nivel 3 no tiene
    // precio calculado: lo escribe quien factura.
    protected BigDecimal precioSegunNivel(Producto producto, int nivel) {
        return switch (nivel) {
            case 1 -> producto.getPrecio();
            case 2 -> producto.getPrecio()
                    .multiply(BigDecimal.valueOf(100 + RECARGO_NIVEL_2))
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                    .setScale(2, RoundingMode.UNNECESSARY);
            default -> throw new IllegalArgumentException("La lista de precios " + nivel + " no tiene precio calculado.");
        };
    }

    // Venta: desde GENERAL solo se puede vender lo que esta en el local (lo del camion
    // esta en la calle); desde CAMION se descuenta del camion y del stock general.
    protected void descontarPorVenta(Producto producto, OrigenVenta origen, int cantidad) {
        verificarDisponibleParaVenta(producto, origen, cantidad);
        quitarDe(producto, almacenDe(origen), cantidad);
    }

    protected void verificarDisponibleParaVenta(Producto producto, OrigenVenta origen, int cantidad) {
        Almacen almacen = almacenDe(origen);
        int disponible = disponibleEn(producto, almacen);
        if (disponible < cantidad) {
            String donde = almacen == Almacen.CAMION ? " en el camion" : " en el local";
            String nota = almacen == Almacen.GENERAL && producto.getStockCamion() > 0
                    ? " (" + producto.getStockCamion() + " mas van en el camion)" : "";
            throw new StockInsuficienteException("Stock insuficiente para \"" + producto.getNombre() + "\"" + donde
                    + ". Disponible: " + disponible + nota + ", solicitado: " + cantidad);
        }
    }

    // Anulacion: las unidades vuelven a donde salieron.
    protected void devolverPorAnulacion(Producto producto, OrigenVenta origen, int cantidad) {
        ponerEn(producto, almacenDe(origen), cantidad);
    }

    private Almacen almacenDe(OrigenVenta origen) {
        return origen == OrigenVenta.CAMION ? Almacen.CAMION : Almacen.GENERAL;
    }

    // ---- movimientos de stock (unica definicion de como se mueve cada inventario) ----

    private int disponibleEn(Producto producto, Almacen almacen) {
        return switch (almacen) {
            case GENERAL -> producto.stockEnLocal();
            case CAMION -> producto.getStockCamion();
            case BODEGA -> producto.getStockBodega();
        };
    }

    private void quitarDe(Producto producto, Almacen almacen, int cantidad) {
        switch (almacen) {
            case GENERAL -> producto.setStock(producto.getStock() - cantidad);
            case CAMION -> {
                producto.setStock(producto.getStock() - cantidad);
                producto.setStockCamion(producto.getStockCamion() - cantidad);
            }
            case BODEGA -> producto.setStockBodega(producto.getStockBodega() - cantidad);
        }
    }

    private void ponerEn(Producto producto, Almacen almacen, int cantidad) {
        switch (almacen) {
            case GENERAL -> producto.setStock(sumarConTope(producto.getStock(), cantidad, "del inventario general"));
            case CAMION -> {
                producto.setStock(sumarConTope(producto.getStock(), cantidad, "del inventario general"));
                producto.setStockCamion(producto.getStockCamion() + cantidad);
            }
            case BODEGA -> producto.setStockBodega(sumarConTope(producto.getStockBodega(), cantidad, "de la bodega"));
        }
    }

    private int sumarConTope(int actual, int cantidad, String donde) {
        long nuevo = (long) actual + cantidad;
        if (nuevo > MAX_UNIDADES) {
            throw new IllegalArgumentException("El stock " + donde + " no puede superar " + MAX_UNIDADES + " unidades.");
        }
        return (int) nuevo;
    }

    private String nombreAlmacen(Almacen almacen) {
        return switch (almacen) {
            case GENERAL -> "el local";
            case CAMION -> "el camion";
            case BODEGA -> "la bodega";
        };
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
                producto.getMarca(),
                producto.getStockCamion(),
                producto.getStockBodega()
        );
    }
}
