package com.sebast.comercializados_leon.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sebast.comercializados_leon.Exception.ResourceNotFoundException;
import com.sebast.comercializados_leon.Model.Dto.ClienteDTO;
import com.sebast.comercializados_leon.Model.Entity.Cliente;
import com.sebast.comercializados_leon.Repository.ClienteRepository;
import com.sebast.comercializados_leon.Util.Sanitizador;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ClienteService {

    // Cantidad de clientes que se consideran "destacados" (top N por total comprado)
    private static final int LIMITE_DESTACADOS = 10;

    private final ClienteRepository clienteRepository;
    
    public List<ClienteDTO> listarTodos(){
        Set<Long> idsDestacados = idsClientesDestacados();
        return clienteRepository.findAll().stream()
                    .map(c -> aDTO(c, idsDestacados))
                    .toList();
    }

    public ClienteDTO obtenerPorId(Long id){
        Cliente cliente = buscarEntidad(id);
        return aDTO(cliente, idsClientesDestacados());
    }

    // Spring Data escapa solo los comodines de LIKE (% y _) en las consultas "Containing",
    // asi que el texto se busca literal.
    public List<ClienteDTO> buscarPorNombre(String nombre){
        Set<Long> idsDestacados = idsClientesDestacados();
        return clienteRepository.findByNombreContainingIgnoreCase(Sanitizador.limpiar(nombre)).stream()
                    .map(c -> aDTO(c, idsDestacados))
                    .toList();
    }

    // Lista de clientes destacados (los que mas han comprado), lista para mostrar en el
    // apartado especial del sistema.
    public List<ClienteDTO> listarDestacados() {
        List<Cliente> destacados = clientesDestacados();
        Set<Long> ids = destacados.stream().map(Cliente::getId).collect(Collectors.toSet());
        return destacados.stream()
                .map(cliente -> aDTO(cliente, ids))
                .toList();
    }

    public ClienteDTO crear(ClienteDTO dto){
        Cliente cliente = new Cliente();
        aplicarDTOaEntity(dto, cliente);
        Cliente guardado = clienteRepository.save(cliente);
        // Un cliente nuevo arranca en 0, asi que nunca puede ser destacado todavia:
        // se evita la consulta del top N.
        return aDTO(guardado, Set.of());
    }

    public ClienteDTO actualizar(Long id, ClienteDTO dto){
        Cliente cliente = buscarEntidad(id);
        aplicarDTOaEntity(dto, cliente);
        Cliente guardado = clienteRepository.save(cliente);
        return aDTO(guardado, idsClientesDestacados());
    }

    public void eliminar(Long id){
        if(!clienteRepository.existsById(id)){
            throw new ResourceNotFoundException("Cliente con el id: " + id + " no encontrado.");
        }
        clienteRepository.deleteById(id);
    }
    

    // ---- Metodos internos usados por FacturaService ----

    protected Cliente buscarEntidad(Long id) {
        return clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado con id: " + id));
    }

    protected void sumarACompras(Cliente cliente, BigDecimal monto) {
        BigDecimal actual = cliente.getTotalCompras() == null ? BigDecimal.ZERO : cliente.getTotalCompras();
        cliente.setTotalCompras(actual.add(monto));
        clienteRepository.save(cliente);
    }

    protected void restarACompras(Cliente cliente, BigDecimal monto) {
        BigDecimal actual = cliente.getTotalCompras() == null ? BigDecimal.ZERO : cliente.getTotalCompras();
        BigDecimal nuevo = actual.subtract(monto);
        cliente.setTotalCompras(nuevo.max(BigDecimal.ZERO));
        clienteRepository.save(cliente);
    }

    // ---- Helpers ----

    // Top N por total comprado, excluyendo a quienes todavia no han comprado nada.
    // Es la unica definicion de "destacado"; listarDestacados y el flag del DTO la comparten.
    private List<Cliente> clientesDestacados(){
        return clienteRepository.findByOrderByTotalComprasDesc(PageRequest.of(0, LIMITE_DESTACADOS)).stream()
                .filter(c -> c.getTotalCompras() != null && c.getTotalCompras().compareTo(BigDecimal.ZERO) > 0)
                .toList();
    }

    private Set<Long> idsClientesDestacados(){
        return clientesDestacados().stream().map(Cliente::getId).collect(Collectors.toSet());
    }

    private void aplicarDTOaEntity(ClienteDTO dto, Cliente cliente){
        cliente.setNombre(dto.getNombre());
        cliente.setNit(dto.getNit());
        cliente.setTelefono(dto.getTelefono());
        cliente.setEmail(dto.getEmail());
    }

    private ClienteDTO aDTO(Cliente cliente, Set<Long> idsDestacados){
        return new ClienteDTO(
            cliente.getId(),
            cliente.getNombre(),
            cliente.getNit(),
            cliente.getTelefono(),
            cliente.getEmail(),
            cliente.getTotalCompras(),
            idsDestacados.contains(cliente.getId())
        );
    }
}
