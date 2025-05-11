package com.backend.IMonitoring.dto;


import jakarta.validation.constraints.Pattern;
import lombok.Data;
import jakarta.validation.constraints.NotBlank;


@Data
public class AvailabilityRequest {
    @NotBlank(message = "El ID de la sala es obligatorio")
    private String classroomId;

    @NotBlank(message = "La fecha es obligatoria (yyyy-MM-dd)")
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "Formato de fecha inválido. Use yyyy-MM-dd")
    private String date;

    @NotBlank(message = "La hora de inicio es obligatoria (HH:mm)")
    @Pattern(regexp = "^([01]?\\d|2[0-3]):[0-5]\\d$", message = "Formato de hora inválido. Use HH:mm (24h)")
    private String startTime;

    @NotBlank(message = "La hora de fin es obligatoria (HH:mm)")
    @Pattern(regexp = "^([01]?\\d|2[0-3]):[0-5]\\d$", message = "Formato de hora inválido. Use HH:mm (24h)")
    private String endTime;
}