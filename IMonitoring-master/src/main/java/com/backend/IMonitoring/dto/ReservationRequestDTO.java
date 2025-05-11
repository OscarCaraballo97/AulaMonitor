package com.backend.IMonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReservationRequestDTO {
    @NotBlank(message = "El ID de la sala es obligatorio")
    private String classroomId;

    @NotBlank(message = "El ID del usuario es obligatorio")
    private String userId;

    @NotNull(message = "La fecha y hora de inicio es obligatoria")
    private LocalDateTime startTime;

    @NotNull(message = "La fecha y hora de fin es obligatoria")
    private LocalDateTime endTime;
}