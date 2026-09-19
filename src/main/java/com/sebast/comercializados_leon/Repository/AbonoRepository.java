package com.sebast.comercializados_leon.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sebast.comercializados_leon.Model.Entity.Abono;

public interface AbonoRepository extends JpaRepository<Abono, Long> {

    List<Abono> findByFacturaIdOrderByFechaAscIdAsc(Long facturaId);

}
