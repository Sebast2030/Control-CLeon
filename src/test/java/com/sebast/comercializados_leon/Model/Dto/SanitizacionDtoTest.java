package com.sebast.comercializados_leon.Model.Dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.json.JsonMapper;

// Los DTOs limpian el texto al leerse del JSON, antes de que corra la validacion.
class SanitizacionDtoTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void clienteLlegaNormalizadoDesdeJson() {
        ClienteDTO dto = mapper.readValue("""
                {"nombre":"  Maria   Gomez ","nit":"","telefono":"  ","email":" a@b.co "}
                """, ClienteDTO.class);

        assertThat(dto.getNombre()).isEqualTo("Maria Gomez");
        assertThat(dto.getNit()).isNull();
        assertThat(dto.getTelefono()).isNull();
        assertThat(dto.getEmail()).isEqualTo("a@b.co");
    }

    @Test
    void productoLlegaNormalizadoDesdeJson() {
        ProductoDTO dto = mapper.readValue("""
                {"nombre":" Silenciador\\t\\tAveo ","categoria":" Tuberia ","marca":"cleon ","precio":1,"stock":1}
                """, ProductoDTO.class);

        assertThat(dto.getNombre()).isEqualTo("Silenciador Aveo");
        assertThat(dto.getCategoria()).isEqualTo("Tuberia");
        assertThat(dto.getMarca()).isEqualTo("cleon");
    }

    @Test
    void facturaYTrasladoLeenSusEnumsDesdeJson() {
        FacturaCreateRequest factura = mapper.readValue("""
                {"clienteId":1,"origen":"CAMION","items":[{"productoId":2,"cantidad":3,"precioUnitario":150000}]}
                """, FacturaCreateRequest.class);
        assertThat(factura.getOrigen()).isEqualTo(com.sebast.comercializados_leon.Model.Entity.OrigenVenta.CAMION);
        assertThat(factura.getItems().get(0).getPrecioUnitario()).isEqualByComparingTo("150000");

        AbonoRequest abono = mapper.readValue("{\"monto\":25000}", AbonoRequest.class);
        assertThat(abono.getMonto()).isEqualByComparingTo("25000");

        ClienteDTO cliente = mapper.readValue("{\"nombre\":\"Ana\",\"ciudad\":\"  Santa   Marta \",\"nivelPrecio\":2}", ClienteDTO.class);
        assertThat(cliente.getCiudad()).isEqualTo("Santa Marta");
        assertThat(cliente.getNivelPrecio()).isEqualTo(2);
    }

    @Test
    void unAlmacenInventadoSeRechaza() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> mapper.readValue(
                "{\"origen\":\"CASA\",\"destino\":\"BODEGA\",\"cantidad\":1}", TrasladoRequest.class))
                .isInstanceOf(tools.jackson.core.JacksonException.class);
    }

    @Test
    void laContrasenaNoSeModifica() {
        LoginRequest dto = mapper.readValue("""
                {"usuario":" Admin_Cleon#2026 ","password":"  con  espacios  "}
                """, LoginRequest.class);

        assertThat(dto.getUsuario()).isEqualTo("Admin_Cleon#2026");
        assertThat(dto.getPassword()).isEqualTo("  con  espacios  ");
        assertThat(dto.toString()).doesNotContain("espacios");
    }
}
