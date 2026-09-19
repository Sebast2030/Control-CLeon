package com.sebast.comercializados_leon.Security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.Resultado;
import com.sebast.comercializados_leon.Security.LimitadorDePeticiones.TipoLimite;

class LimitadorDePeticionesTest {

    private final LimitadorDePeticiones limitador = new LimitadorDePeticiones();

    private int permitidasSeguidas(TipoLimite tipo, String clave, int intentos) {
        int permitidas = 0;
        for (int i = 0; i < intentos; i++) {
            if (limitador.consumir(tipo, clave).permitido()) {
                permitidas++;
            }
        }
        return permitidas;
    }

    @Test
    void cortaLaIpAlSuperarElLimite() {
        assertThat(permitidasSeguidas(TipoLimite.IP, "10.0.0.1", 150)).isEqualTo(100);

        Resultado rechazo = limitador.consumir(TipoLimite.IP, "10.0.0.1");
        assertThat(rechazo.permitido()).isFalse();
        assertThat(rechazo.segundosDeEspera()).isPositive();
    }

    @Test
    void cadaIpTieneSuPropioLimite() {
        permitidasSeguidas(TipoLimite.IP, "10.0.0.1", 150);
        assertThat(limitador.consumir(TipoLimite.IP, "10.0.0.2").permitido()).isTrue();
    }

    @Test
    void elLimiteDeUsuarioEsIndependienteDelDeIp() {
        permitidasSeguidas(TipoLimite.IP, "7", 150);
        assertThat(permitidasSeguidas(TipoLimite.USUARIO, "7", 250)).isEqualTo(200);
    }

    @Test
    void elLoginSoloPermiteCincoIntentosSeguidos() {
        assertThat(permitidasSeguidas(TipoLimite.LOGIN, "10.0.0.9", 10)).isEqualTo(5);
    }
}
