package com.sebast.comercializados_leon.Service;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sebast.comercializados_leon.Exception.ResourceNotFoundException;
import com.sebast.comercializados_leon.Exception.StockInsuficienteException;
import com.sebast.comercializados_leon.Model.Dto.*;
import com.sebast.comercializados_leon.Model.Entity.*;
import com.sebast.comercializados_leon.Repository.FacturaRepository;
import com.sebast.comercializados_leon.Util.Sanitizador;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class FacturaService {

    private final FacturaRepository facturaRepository;
    private final ClienteService clienteService;
    private final ProductoService productoService;

    public List<FacturaDTO> listarFiltradas(String estado, Long clienteId, String ordenarPor) {
        return facturaRepository.buscarConFiltros(clienteId, parsearEstado(estado), parsearOrden(ordenarPor)).stream()
                .map(this::aDTO)
                .toList();
    }

    public FacturaDTO obtenerPorId(Long id) {
        return aDTO(buscarEntidad(id));
    }

    // Crea la factura: valida stock, descuenta inventario y calcula totales.
    // El monto NO se suma a las compras del cliente todavia; eso pasa al pagarla.
    public FacturaDTO crear(FacturaCreateRequest request) {
        Cliente cliente = clienteService.buscarEntidad(request.getClienteId());

        Factura factura = new Factura();
        factura.setCliente(cliente);
        factura.setEstado(EstadoFactura.PENDIENTE);
        factura.setTotal(BigDecimal.ZERO);

        // Paso 1: Guardar e insertar la factura inmediatamente en PostgreSQL.
        // Esto asigna y genera el ID de la factura ANTES de intentar procesar sus detalles.
        Factura facturaPersistida = facturaRepository.saveAndFlush(factura);

        BigDecimal totalFactura = BigDecimal.ZERO;

        for (FacturaItemRequest item : request.getItems()) {
            Producto producto = productoService.buscarEntidad(item.getProductoId());

            if (producto.getStock() < item.getCantidad()) {
                throw new StockInsuficienteException(
                        "Stock insuficiente para \"" + producto.getNombre() + "\". Disponible: "
                                + producto.getStock() + ", solicitado: " + item.getCantidad());
            }

            // Descontar stock
            producto.setStock(producto.getStock() - item.getCantidad());

            BigDecimal subtotal = producto.getPrecio().multiply(BigDecimal.valueOf(item.getCantidad()));

            DetalleFactura detalle = new DetalleFactura();
            detalle.setProducto(producto);
            detalle.setCantidad(item.getCantidad());
            detalle.setPrecioUnitario(producto.getPrecio());
            detalle.setSubtotal(subtotal);
            detalle.setTotal(subtotal); // sin descuentos por ahora

            // Paso 2: Asociar el detalle a la factura que ya posee un ID válido en PostgreSQL
            facturaPersistida.agregarDetalle(detalle);
            totalFactura = totalFactura.add(subtotal);
        }

        facturaPersistida.setTotal(totalFactura);

        // Paso 3: Sincronizar todos los cambios y guardar las filas en detalle_factura
        return aDTO(facturaRepository.saveAndFlush(facturaPersistida));
    }

    // Marca una factura pendiente como pagada y recien ahi suma el monto a las compras
    // totales del cliente (lo que alimenta el ranking de "destacados"). No mueve stock:
    // eso ya ocurrio al crear la factura.
    public FacturaDTO pagar(Long id){
        Factura factura = buscarEntidad(id);

        if(factura.getEstado() == EstadoFactura.ANULADA){
            throw new IllegalArgumentException("No se puede marcar como pagada una factura anulada");
        }
        if(factura.getEstado() == EstadoFactura.PAGADA){
            throw new IllegalArgumentException("Esta factura ya esta pagada");
        }

        factura.setEstado(EstadoFactura.PAGADA);
        Factura guardada = facturaRepository.save(factura);
        clienteService.sumarACompras(factura.getCliente(), factura.getTotal());
        return aDTO(guardada);
    }

    // Anula una factura: restaura el stock de cada producto y, solo si estaba pagada,
    // resta el monto de las compras totales del cliente.
    public FacturaDTO anular(Long id) {
        Factura factura = buscarEntidad(id);

        if (factura.getEstado() == EstadoFactura.ANULADA) {
            throw new IllegalArgumentException("La factura ya se encuentra anulada");
        }

        boolean estabaPagada = factura.getEstado() == EstadoFactura.PAGADA;

        for (DetalleFactura detalle : factura.getDetalles()) {
            Producto producto = detalle.getProducto();
            producto.setStock(producto.getStock() + detalle.getCantidad());
        }

        // Si estaba pendiente, su monto nunca se sumo al cliente: no hay nada que restar.
        if (estabaPagada) {
            clienteService.restarACompras(factura.getCliente(), factura.getTotal());
        }

        factura.setEstado(EstadoFactura.ANULADA);
        return aDTO(facturaRepository.save(factura));
    }

    // ---- helpers ----

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

    private FacturaDTO aDTO(Factura factura) {
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
                factura.getEstado(),
                detalles
        );
    }
}
