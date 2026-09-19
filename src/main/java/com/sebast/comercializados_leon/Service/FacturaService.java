package com.sebast.comercializados_leon.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sebast.comercializados_leon.Exception.ResourceNotFoundException;
import com.sebast.comercializados_leon.Model.Dto.*;
import com.sebast.comercializados_leon.Model.Entity.*;
import com.sebast.comercializados_leon.Repository.AbonoRepository;
import com.sebast.comercializados_leon.Repository.FacturaRepository;
import com.sebast.comercializados_leon.Util.Sanitizador;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class FacturaService {

    // total y subtotal son NUMERIC(14,2) en la base: hasta 12 digitos enteros.
    private static final BigDecimal TOTAL_MAXIMO = new BigDecimal("999999999999.99");

    private final FacturaRepository facturaRepository;
    private final AbonoRepository abonoRepository;
    private final ClienteService clienteService;
    private final ProductoService productoService;

    public List<FacturaDTO> listarFiltradas(String estado, Long clienteId, String origen, String ordenarPor) {
        return facturaRepository.buscarConFiltros(clienteId, parsearEstado(estado), parsearOrigen(origen),
                        parsearOrden(ordenarPor)).stream()
                .map(f -> aDTO(f, null))
                .toList();
    }

    public FacturaDTO obtenerPorId(Long id) {
        Factura factura = buscarEntidad(id);
        return aDTO(factura, abonosDe(factura));
    }

    // Crea la factura: valida stock, descuenta inventario y calcula totales.
    // El monto NO se suma a las compras del cliente todavia; eso pasa al pagarla.
    //   - origen GENERAL vende de lo que hay en el local; CAMION descuenta del camion y
    //     del stock general (el camion es parte del general).
    //   - el precio sale de la lista de precios del cliente: 1 y 2 los calcula el backend
    //     (lo que mande el frontend se ignora); en la 3 se usa el que escribio el usuario.
    public FacturaDTO crear(FacturaCreateRequest request) {
        Cliente cliente = clienteService.buscarEntidad(request.getClienteId());
        OrigenVenta origen = request.getOrigen() != null ? request.getOrigen() : OrigenVenta.GENERAL;
        int nivel = cliente.getNivelPrecio() != null ? cliente.getNivelPrecio() : 1;

        // Se bloquean los productos de la factura siempre en el mismo orden (por id): asi
        // dos facturas simultaneas con los mismos productos no se quedan esperando la una
        // a la otra (deadlock).
        Map<Long, Producto> productos = new TreeMap<>();
        for (FacturaItemRequest item : request.getItems()) {
            productos.putIfAbsent(item.getProductoId(), null);
        }
        productos.replaceAll((id, sinCargar) -> productoService.buscarParaActualizar(id));

        // Todo se valida ANTES de insertar la factura: si falta stock o un precio, no se
        // gasta un numero de factura (el id de PostgreSQL no se devuelve al deshacer).
        Map<Long, Integer> unidadesPorProducto = new TreeMap<>();
        BigDecimal totalEstimado = BigDecimal.ZERO;
        for (FacturaItemRequest item : request.getItems()) {
            BigDecimal precio = precioDeVenta(productos.get(item.getProductoId()), nivel, item);
            totalEstimado = totalEstimado.add(precio.multiply(BigDecimal.valueOf(item.getCantidad())));
            unidadesPorProducto.merge(item.getProductoId(), item.getCantidad(), Integer::sum);
        }
        if (totalEstimado.compareTo(TOTAL_MAXIMO) > 0) {
            throw new IllegalArgumentException("El total de la factura es demasiado grande. Revisa los precios y las cantidades.");
        }
        unidadesPorProducto.forEach((id, cantidad) ->
                productoService.verificarDisponibleParaVenta(productos.get(id), origen, cantidad));

        Factura factura = new Factura();
        factura.setCliente(cliente);
        factura.setEstado(EstadoFactura.PENDIENTE);
        factura.setTotal(BigDecimal.ZERO);
        factura.setTotalPagado(BigDecimal.ZERO);
        factura.setOrigen(origen);
        factura.setNivelPrecio(nivel);

        // Paso 1: Guardar e insertar la factura inmediatamente en PostgreSQL.
        // Esto asigna y genera el ID de la factura ANTES de intentar procesar sus detalles.
        Factura facturaPersistida = facturaRepository.saveAndFlush(factura);

        BigDecimal totalFactura = BigDecimal.ZERO;

        for (FacturaItemRequest item : request.getItems()) {
            Producto producto = productos.get(item.getProductoId());

            // Valida y descuenta el stock del lugar de donde sale (local o camion)
            productoService.descontarPorVenta(producto, origen, item.getCantidad());

            BigDecimal precioUnitario = precioDeVenta(producto, nivel, item);
            BigDecimal subtotal = precioUnitario.multiply(BigDecimal.valueOf(item.getCantidad()));

            DetalleFactura detalle = new DetalleFactura();
            detalle.setProducto(producto);
            detalle.setCantidad(item.getCantidad());
            detalle.setPrecioUnitario(precioUnitario);
            detalle.setSubtotal(subtotal);
            detalle.setTotal(subtotal); // sin descuentos por ahora

            // Paso 2: Asociar el detalle a la factura que ya posee un ID válido en PostgreSQL
            facturaPersistida.agregarDetalle(detalle);
            totalFactura = totalFactura.add(subtotal);
        }

        facturaPersistida.setTotal(totalFactura);

        // Paso 3: Sincronizar todos los cambios y guardar las filas en detalle_factura
        return aDTO(facturaRepository.saveAndFlush(facturaPersistida), List.of());
    }

    // Marca una factura pendiente como pagada y recien ahi suma el monto a las compras
    // totales del cliente (lo que alimenta el ranking de "destacados"). No mueve stock:
    // eso ya ocurrio al crear la factura. Lo que faltaba por pagar queda como un abono,
    // asi la suma de los abonos siempre cuadra con el total pagado.
    public FacturaDTO pagar(Long id){
        Factura factura = buscarParaActualizar(id);
        validarPendiente(factura);

        BigDecimal saldo = saldoDe(factura);
        if (saldo.signum() > 0) {
            registrarAbono(factura, saldo);
        }
        marcarPagada(factura);
        return aDTO(facturaRepository.save(factura), abonosDe(factura));
    }

    // Registra un pago parcial. No puede pasarse de lo que falta por pagar; si lo
    // completa, la factura queda PAGADA (y ahi se suma a las compras del cliente,
    // igual que con pagar).
    public FacturaDTO abonar(Long id, AbonoRequest request) {
        Factura factura = buscarParaActualizar(id);
        validarPendiente(factura);

        BigDecimal monto = request.getMonto();
        BigDecimal saldo = saldoDe(factura);
        if (monto.compareTo(saldo) > 0) {
            throw new IllegalArgumentException("El abono (" + monto.toPlainString() + ") supera lo que falta por pagar ("
                    + saldo.toPlainString() + ").");
        }

        registrarAbono(factura, monto);
        if (saldoDe(factura).signum() == 0) {
            marcarPagada(factura);
        }
        return aDTO(facturaRepository.save(factura), abonosDe(factura));
    }

    // Anula una factura: restaura el stock de cada producto (al camion si salio del
    // camion) y, solo si estaba pagada, resta el monto de las compras totales del cliente.
    // Los abonos quedan registrados: son plata que el cliente si entrego.
    public FacturaDTO anular(Long id) {
        Factura factura = buscarParaActualizar(id);

        if (factura.getEstado() == EstadoFactura.ANULADA) {
            throw new IllegalArgumentException("La factura ya se encuentra anulada");
        }

        boolean estabaPagada = factura.getEstado() == EstadoFactura.PAGADA;

        // Mismo orden de bloqueo que al crear (por id), para no cruzarse con otra operacion.
        Map<Long, Integer> unidadesPorProducto = new TreeMap<>();
        for (DetalleFactura detalle : factura.getDetalles()) {
            unidadesPorProducto.merge(detalle.getProducto().getId(), detalle.getCantidad(), Integer::sum);
        }
        unidadesPorProducto.forEach((productoId, cantidad) -> productoService.devolverPorAnulacion(
                productoService.buscarParaActualizar(productoId), factura.getOrigen(), cantidad));

        // Si estaba pendiente, su monto nunca se sumo al cliente: no hay nada que restar.
        if (estabaPagada) {
            clienteService.restarACompras(factura.getCliente(), factura.getTotal());
        }

        factura.setEstado(EstadoFactura.ANULADA);
        return aDTO(facturaRepository.save(factura), abonosDe(factura));
    }

    // ---- helpers ----

    private BigDecimal precioDeVenta(Producto producto, int nivel, FacturaItemRequest item) {
        if (nivel != ProductoService.NIVEL_PRECIO_LIBRE) {
            return productoService.precioSegunNivel(producto, nivel);
        }
        if (item.getPrecioUnitario() == null) {
            throw new IllegalArgumentException("El cliente es de precio libre (lista 3): escribe el precio de \""
                    + producto.getNombre() + "\".");
        }
        return item.getPrecioUnitario();
    }

    private void validarPendiente(Factura factura) {
        if (factura.getEstado() == EstadoFactura.ANULADA) {
            throw new IllegalArgumentException("La factura esta anulada: no admite pagos");
        }
        if (factura.getEstado() == EstadoFactura.PAGADA) {
            throw new IllegalArgumentException("Esta factura ya esta pagada");
        }
    }

    private BigDecimal saldoDe(Factura factura) {
        return factura.getTotal().subtract(factura.getTotalPagado());
    }

    private void registrarAbono(Factura factura, BigDecimal monto) {
        Abono abono = new Abono();
        abono.setFactura(factura);
        abono.setMonto(monto);
        abonoRepository.save(abono);
        factura.setTotalPagado(factura.getTotalPagado().add(monto));
    }

    private void marcarPagada(Factura factura) {
        factura.setEstado(EstadoFactura.PAGADA);
        clienteService.sumarACompras(factura.getCliente(), factura.getTotal());
    }

    private List<AbonoDTO> abonosDe(Factura factura) {
        return abonoRepository.findByFacturaIdOrderByFechaAscIdAsc(factura.getId()).stream()
                .map(a -> new AbonoDTO(a.getId(), a.getMonto(), a.getFecha()))
                .toList();
    }

    private OrigenVenta parsearOrigen(String origen) {
        String valor = Sanitizador.limpiar(origen);
        if (valor == null) {
            return null;
        }
        try {
            return OrigenVenta.valueOf(valor.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Origen invalido. Debe ser GENERAL o CAMION.");
        }
    }

    private EstadoFactura parsearEstado(String estado) {
        String valor = Sanitizador.limpiar(estado);
        if (valor == null) {
            return null;
        }
        try {
            return EstadoFactura.valueOf(valor.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado invalido. Debe ser PENDIENTE, PAGADA o ANULADA.");
        }
    }

    // Lista blanca: solo se puede ordenar por estas columnas. El nombre de la columna
    // nunca sale directamente de lo que manda el usuario.
    private Sort parsearOrden(String ordenarPor) {
        String valor = Sanitizador.limpiar(ordenarPor);
        if (valor == null || valor.equalsIgnoreCase("fecha")) {
            return Sort.by(Sort.Direction.DESC, "fecha");
        }
        if (valor.equalsIgnoreCase("total")) {
            return Sort.by(Sort.Direction.DESC, "total");
        }
        throw new IllegalArgumentException("Orden invalido. Debe ser \"fecha\" o \"total\".");
    }

    private Factura buscarEntidad(Long id) {
        return facturaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Factura no encontrada con id: " + id));
    }

    private Factura buscarParaActualizar(Long id) {
        return facturaRepository.buscarParaActualizar(id)
                .orElseThrow(() -> new ResourceNotFoundException("Factura no encontrada con id: " + id));
    }

    private FacturaDTO aDTO(Factura factura, List<AbonoDTO> abonos) {
        List<DetalleFacturaDTO> detalles = factura.getDetalles().stream()
                .map(d -> new DetalleFacturaDTO(
                        d.getId(),
                        d.getProducto().getId(),
                        d.getProducto().getNombre(),
                        d.getCantidad(),
                        d.getPrecioUnitario(),
                        d.getSubtotal(),
                        d.getTotal()
                ))
                .toList();

        return new FacturaDTO(
                factura.getId(),
                factura.getCliente().getId(),
                factura.getCliente().getNombre(),
                factura.getFecha(),
                factura.getTotal(),
                factura.getTotalPagado(),
                factura.getEstado(),
                factura.getOrigen(),
                factura.getNivelPrecio(),
                detalles,
                abonos
        );
    }
}
