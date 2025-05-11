package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.repository.ClassroomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClassroomService {
    private final ClassroomRepository classroomRepository;

    public List<Classroom> getAllClassrooms() {
        return classroomRepository.findAll();
    }

    public List<Classroom> getAvailableNow() {
        return classroomRepository.findAvailableNow();
    }

    public List<Classroom> getUnavailableNow() {
        return classroomRepository.findUnavailableNow();
    }

    public List<Classroom> getClassroomsByType(ClassroomType type) {
        return classroomRepository.findByType(type);
    }

    public List<Classroom> getClassroomsByMinCapacity(Integer minCapacity) {
        return classroomRepository.findByCapacityGreaterThanEqual(minCapacity);
    }

    public Classroom getClassroomById(String id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Classroom not found"));
    }

    public Classroom createClassroom(Classroom classroom) {
        return classroomRepository.save(classroom);
    }

    public Classroom updateClassroom(String id, Classroom classroom) {
        Classroom existing = getClassroomById(id);
        existing.setName(classroom.getName());
        existing.setCapacity(classroom.getCapacity());
        existing.setType(classroom.getType());
        existing.setResources(classroom.getResources());
        existing.setBuilding(classroom.getBuilding());
        return classroomRepository.save(existing);
    }

    public void deleteClassroom(String id) {
        classroomRepository.deleteById(id);
    }

    public boolean checkAvailability(AvailabilityRequest request) {
        LocalDateTime start = parseDateTime(request.getDate(), request.getStartTime());
        LocalDateTime end = parseDateTime(request.getDate(), request.getEndTime());

        if (start.isAfter(end)) {
            throw new IllegalArgumentException("La hora de inicio debe ser antes que la hora de fin.");
        }

        if (Duration.between(start, end).toHours() != 2) {
            throw new IllegalArgumentException("El bloque de tiempo debe ser de 2 horas exactas.");
        }

        return classroomRepository.isAvailable(request.getClassroomId(), start, end);
    }

    private LocalDateTime parseDateTime(String date, String time) {
        try {
            String dateTimeString = date + "T" + time + ":00";
            return LocalDateTime.parse(dateTimeString, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Formato de fecha u hora inválido.");
        }
    }
}