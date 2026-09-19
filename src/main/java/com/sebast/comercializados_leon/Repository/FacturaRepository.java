package com.sebast.comercializados_leon.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sebast.comercializados_leon.Model.Entity.EstadoFactura;
import com.sebast.comercializados_leon.Model.Entity.Factura;
import com.sebast.comercializados_leon.Model.Entity.OrigenVenta;

import jakarta.persistence.LockModeType;

public interface FacturaRepository extends JpaRepository<Factura, Long> {

    // Listado con filtros opcionales (null = sin filtrar) y orden configurable.
    // El EntityGraph trae cliente, detalles y productos en la misma consulta: sin el,
    // armar el DTO de cada factura disparaba una consulta extra por factura (N+1).
    @EntityGraph(attributePaths = {"cliente", "detalles", "detalles.producto"})
    @Query("""
            SELECT f FROM Factura f
            WHERE (:clienteId IS NULL OR f.cliente.id = :clienteId)
              AND (:estado IS NULL OR f.estado = :estado)
              AND (:origen IS NULL OR f.origen = :origen)
            """)
    List<Factura> buscarConFiltros(@Param("clienteId") Long clienteId,
                                   @Param("estado") EstadoFactura estado,
                                   @Param("origen") OrigenVenta origen,
                                   Sort sort);

    // Bloquea la fila de la factura hasta que termine la transaccion (SELECT ... FOR
    // UPDATE). Pagar, abonar y anular la usan: dos clics seguidos o dos equipos a la vez
    // no pueden anular dos veces (devolviendo el stock doble) ni pasarse del total.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT f FROM Factura f WHERE f.id = :id")
    Optional<Factura> buscarParaActualizar(@Param("id") Long id);

}
