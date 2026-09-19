package com.sebast.comercializados_leon.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sebast.comercializados_leon.Model.Entity.Producto;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    List<Producto> findByCodigoStartingWithIgnoreCase(String prefijo);

    List<Producto> findAllByOrderByCodigoAsc();

    List<Producto> findByStockLessThanEqualOrderByCodigoAsc(Integer stockMaximo);

    // Busqueda con filtros opcionales: cualquier parametro en null se ignora.
    // Se resuelve en PostgreSQL en lugar de traer todo el inventario y filtrar en Java.
    //
    // Los CAST son obligatorios: cuando el parametro llega en null, PostgreSQL no puede
    // deducir su tipo y falla con "function lower(bytea) does not exist".
    //
    // :q llega con % y _ ya escapados (Sanitizador.escaparLike), y ESCAPE '\' hace que
    // se busquen como texto literal en lugar de actuar como comodines.
    @Query("""
            SELECT p FROM Producto p
            WHERE (:q IS NULL
                   OR LOWER(p.nombre) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) ESCAPE '\\'
                   OR LOWER(p.codigo) LIKE LOWER(CONCAT(CAST(:q AS String), '%')) ESCAPE '\\')
              AND (:categoria IS NULL OR LOWER(p.categoria) = LOWER(CAST(:categoria AS String)))
              AND (:marca IS NULL OR LOWER(p.marca) = LOWER(CAST(:marca AS String)))
            ORDER BY p.codigo ASC
            """)
    List<Producto> buscarConFiltros(@Param("q") String q,
                                    @Param("categoria") String categoria,
                                    @Param("marca") String marca);

}
