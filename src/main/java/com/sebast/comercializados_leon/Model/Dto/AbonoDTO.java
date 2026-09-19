package com.sebast.comercializados_leon.Model.Dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AbonoDTO {

    private Long id;
    private BigDecimal monto;
    private LocalDateTime fecha;

}
