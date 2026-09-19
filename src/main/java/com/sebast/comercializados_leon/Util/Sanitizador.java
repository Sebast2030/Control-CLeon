package com.sebast.comercializados_leon.Util;

import java.text.Normalizer;
import java.util.regex.Pattern;

// Limpieza y reglas de validacion de todo el texto que entra a la API.
//
// La estrategia es: primero se NORMALIZA (limpiar) y despues se VALIDA con listas
// blancas (los patrones de abajo, usados con @Pattern). Lo que no cumple se rechaza
// con un 400; nunca se "arregla" en silencio quitando caracteres.
public final class Sanitizador {

    private Sanitizador() {
    }

    // Nombres de productos y clientes, y busquedas: letras (con tildes y ñ), numeros,
    // espacios y la puntuacion que aparece en nombres reales (Silenciador 2.5" (E3),
    // Taller O'Brien & Cia.). Sin < > ni caracteres de control.
    public static final String TEXTO = "^[\\p{L}\\p{M}\\p{N} .,'\"()/#&+°_\\-]*$";

    // Cedula o NIT: 1020304050, 900123456-1, 1.020.304.050
    public static final String NIT = "^[0-9A-Za-z.\\-]*$";

    public static final String TELEFONO = "^[0-9+() \\-]*$";

    public static final String EMAIL = "^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$";

    // Nombre de usuario del login (ej: Admin_Cleon#2026)
    public static final String USUARIO = "^[A-Za-z0-9_#.@\\-]*$";

    private static final Pattern ESPACIOS = Pattern.compile("\\s+");

    // Normaliza un texto de entrada: forma Unicode NFC (una "é" siempre se guarda igual),
    // sin espacios al inicio o al final, espacios repetidos o tabs/saltos de linea
    // convertidos en un solo espacio, y vacio -> null.
    // No se usa en contrasenas: esas se comparan tal cual llegan.
    public static String limpiar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpio = ESPACIOS.matcher(Normalizer.normalize(valor, Normalizer.Form.NFC)).replaceAll(" ").strip();
        return limpio.isEmpty() ? null : limpio;
    }

    // Clave para comparar textos sin importar mayusculas ni tildes ("Medellín" = "medellin").
    public static String claveSinTildes(String valor) {
        if (valor == null) {
            return null;
        }
        String sinMarcas = Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return sinMarcas.toLowerCase(java.util.Locale.ROOT);
    }

    // Escapa los comodines de LIKE (% y _) para que una busqueda los trate como texto
    // literal. Va con ESCAPE '\' en la consulta (ver ProductoRepository.buscarConFiltros).
    public static String escaparLike(String valor) {
        if (valor == null) {
            return null;
        }
        return valor.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
