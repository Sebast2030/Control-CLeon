package com.sebast.comercializados_leon.Repository;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.sebast.comercializados_leon.Model.Entity.Cliente;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findByNombreContainingIgnoreCase(String nombre);

    // Los "clientes destacados" son los que mas han comprado en total.
    // Se usa Pageable para limitar el resultado (ej: top 10) sin escribir SQL nativo.
    List<Cliente> findByOrderByTotalComprasDesc(PageRequest pageable);

    // Ciudades donde ya hay clientes (para el menu desplegable al crear un cliente).
    @Query("SELECT DISTINCT c.ciudad FROM Cliente c WHERE c.ciudad IS NOT NULL")
    List<String> ciudadesConClientes();
}
