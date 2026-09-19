package com.sebast.comercializados_leon.Exception;

public class StockInsuficienteException extends RuntimeException{
    public StockInsuficienteException(String mensaje){
        super(mensaje);
    }

}
