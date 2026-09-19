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
    void laContrasenaNoSeModifica() {
        LoginRequest dto = mapper.readValue("""
                {"usuario":" Admin_Cleon#2026 ","password":"  con  espacios  "}
                """, LoginRequest.class);

        assertThat(dto.getUsuario()).isEqualTo("Admin_Cleon#2026");
        assertThat(dto.getPassword()).isEqualTo("  con  espacios  ");
        assertThat(dto.toString()).doesNotContain("espacios");
    }
}
