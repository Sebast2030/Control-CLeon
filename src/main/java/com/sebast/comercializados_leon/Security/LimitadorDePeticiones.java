package com.sebast.comercializados_leon.Security;

import java.time.Duration;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

// Rate limiting con "token bucket": cada IP o usuario tiene un balde con N fichas;
// cada peticion gasta una y el balde se rellena poco a poco. Si esta vacio, la
// peticion se rechaza con 429. Permite rafagas normales (el dashboard hace varias
// peticiones a la vez) pero corta scripts, fuerza bruta y abusos.
//
// Los limites se definen UNA sola vez, aqui.
@Component
public class LimitadorDePeticiones {

    public enum TipoLimite {

        // Todas las peticiones desde una misma IP (un celular, el PC del local...).
        IP(() -> Bucket.builder()
                .addLimit(limite -> limite.capacity(100).refillGreedy(100, Duration.ofMinutes(1)))
                .build()),

        // Todas las peticiones de un mismo usuario, sumando todos sus dispositivos.
        // Mayor que el de IP porque el admin puede estar conectado en varios a la vez.
        USUARIO(() -> Bucket.builder()
                .addLimit(limite -> limite.capacity(200).refillGreedy(200, Duration.ofMinutes(1)))
                .build()),

        // Intentos de inicio de sesion desde una misma IP (se suma al limite de IP):
        // 5 seguidos, luego 1 por minuto, y nunca mas de 20 por hora. Aparte, la base
        // bloquea la cuenta 15 minutos tras 5 fallos seguidos (ver db/seguridad.sql).
        LOGIN(() -> Bucket.builder()
                .addLimit(limite -> limite.capacity(5).refillGreedy(1, Duration.ofMinutes(1)))
                .addLimit(limite -> limite.capacity(20).refillIntervally(20, Duration.ofHours(1)))
                .build());

        private final Supplier<Bucket> fabrica;

        TipoLimite(Supplier<Bucket> fabrica) {
            this.fabrica = fabrica;
        }
    }

    public record Resultado(boolean permitido, long segundosDeEspera) {
    }

    private static final Resultado PERMITIDO = new Resultado(true, 0);

    // Un balde por clave (tipo + IP o usuario). Caduca tras 2 horas sin uso (mas que la
    // ventana mas larga, la de 1 hora del login) y hay un tope de entradas para que
    // nadie pueda llenar la memoria inventando claves.
    private final Cache<String, Bucket> baldes = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(2))
            .maximumSize(20_000)
            .build();

    public Resultado consumir(TipoLimite tipo, String clave) {
        Bucket balde = baldes.get(tipo.name() + ":" + clave, k -> tipo.fabrica.get());
        ConsumptionProbe prueba = balde.tryConsumeAndReturnRemaining(1);
        if (prueba.isConsumed()) {
            return PERMITIDO;
        }
        long segundos = Duration.ofNanos(prueba.getNanosToWaitForRefill()).toSeconds() + 1;
        return new Resultado(false, segundos);
    }
}
