package com.sebast.comercializados_leon.Exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> manejarNoEncontrado(ResourceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.NOT_FOUND.value(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(StockInsuficienteException.class)
    public ResponseEntity<ErrorResponse> manejarStockInsuficiente(StockInsuficienteException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.CONFLICT.value(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(CredencialesInvalidasException.class)
    public ResponseEntity<ErrorResponse> manejarCredencialesInvalidas(CredencialesInvalidasException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.UNAUTHORIZED.value(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(CuentaBloqueadaException.class)
    public ResponseEntity<ErrorResponse> manejarCuentaBloqueada(CuentaBloqueadaException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.TOO_MANY_REQUESTS.value(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getSegundosRestantes()))
                .body(error);
    }

    // @Valid sobre un @RequestBody (cuando el metodo no tiene otras validaciones).
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> manejarValidacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fieldError ->
                errores.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage())
        );
        return errorDeValidacion(errores);
    }

    // Validaciones sobre parametros de la URL (@RequestParam, @PathVariable). Si el metodo
    // tambien recibe un @Valid @RequestBody, sus errores por campo llegan por aqui.
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> manejarValidacionDeParametros(HandlerMethodValidationException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(resultado -> {
            if (resultado instanceof ParameterErrors erroresDelCuerpo) {
                for (FieldError fieldError : erroresDelCuerpo.getFieldErrors()) {
                    errores.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
                }
            } else {
                String parametro = resultado.getMethodParameter().getParameterName();
                resultado.getResolvableErrors().forEach(error ->
                        errores.putIfAbsent(parametro, error.getDefaultMessage()));
            }
        });
        return errorDeValidacion(errores);
    }

    // Un parametro con un tipo imposible: /api/productos/abc, ?clienteId=uno
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> manejarTipoInvalido(MethodArgumentTypeMismatchException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.BAD_REQUEST.value(),
                "El parametro \"" + ex.getName() + "\" tiene un formato invalido.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // Cuerpo que no es JSON valido, con campos que no existen, claves repetidas, tipos
    // equivocados o demasiado grande (ver "JSON estricto" en application.properties).
    // El detalle queda en el log; al cliente no se le devuelve el mensaje del parser.
    // Ese mensaje puede traer texto del cliente (ej: el nombre de un campo desconocido):
    // se le quitan los saltos de linea para que no pueda inventar lineas en el log.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> manejarCuerpoIlegible(HttpMessageNotReadableException ex) {
        log.warn("Cuerpo de peticion rechazado: {}", String.valueOf(ex.getMessage()).replaceAll("[\\r\\n]+", " "));
        ErrorResponse error = new ErrorResponse(HttpStatus.BAD_REQUEST.value(),
                "Los datos enviados no tienen un formato valido.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> manejarArgumentoInvalido(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse(HttpStatus.BAD_REQUEST.value(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // Se dispara, por ejemplo, al intentar eliminar un producto o cliente que ya aparece
    // en una factura: PostgreSQL rechaza la operacion por la llave foranea. Sin este
    // manejador el error caia en el generico y el usuario veia un 500 con SQL crudo.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> manejarConflictoDeDatos(DataIntegrityViolationException ex) {
        log.warn("Violacion de integridad de datos", ex);
        ErrorResponse error = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                "No se puede completar la operacion porque el registro esta siendo usado por otros datos. "
                        + "Si es un producto o un cliente, revisa que no aparezca en alguna factura."
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    // Red de seguridad. El detalle queda en el log del servidor y no se envia al cliente,
    // para no exponer mensajes internos de SQL o de Java.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> manejarErrorGeneral(Exception ex) {
        // Errores que Spring ya clasifico con su propio codigo HTTP: ruta inexistente,
        // metodo no permitido, tipo de contenido no soportado. Se respeta ese codigo en
        // lugar de convertirlos en un 500. Se comprueba la interfaz y no una clase
        // concreta porque no todas heredan de ErrorResponseException
        // (NoResourceFoundException, por ejemplo, solo implementa la interfaz).
        if (ex instanceof org.springframework.web.ErrorResponse errorDeSpring) {
            HttpStatusCode status = errorDeSpring.getStatusCode();
            log.warn("Peticion rechazada ({}): {}", status.value(), ex.getMessage());
            String detalle = errorDeSpring.getBody().getDetail();
            ErrorResponse error = new ErrorResponse(
                    status.value(),
                    detalle != null ? detalle : "La peticion no se pudo atender."
            );
            return ResponseEntity.status(status).body(error);
        }

        log.error("Error no controlado", ex);
        ErrorResponse error = new ErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Ocurrio un error inesperado en el servidor. Intentalo de nuevo."
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    // El primer error va en "mensaje" (lo que el frontend muestra en el aviso) y todos,
    // por campo, en "errores" (lo que el frontend marca en cada input del formulario).
    private ResponseEntity<ErrorResponse> errorDeValidacion(Map<String, String> errores) {
        String primero = errores.values().stream().findFirst().orElse("Datos invalidos");
        ErrorResponse error = new ErrorResponse(HttpStatus.BAD_REQUEST.value(), "Error de validacion: " + primero);
        error.setErrores(errores);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

}
