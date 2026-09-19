package com.sebast.comercializados_leon.Repository;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sebast.comercializados_leon.Model.Entity.EstadoFactura;
import com.sebast.comercializados_leon.Model.Entity.Factura;

public interface FacturaRepository extends JpaRepository<Factura, Long> {

    // Listado con filtros opcionales (null = sin filtrar) y orden configurable.
    // El EntityGraph trae cliente, detalles y productos en la misma consulta: sin el,
    // armar el DTO de cada factura disparaba una consulta extra por factura (N+1).
    @EntityGraph(attributePaths = {"cliente", "detalles", "detalles.producto"})
    @Query("""
            SELECT f FROM Factura f
            WHERE (:clienteId IS NULL OR f.cliente.id = :clienteId)
              AND (:estado IS NULL OR f.estado = :estado)
            """)
    List<Factura> buscarConFiltros(@Param("clienteId") Long clienteId,
                                   @Param("estado") EstadoFactura estado,
                                   Sort sort);

}
