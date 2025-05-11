package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.service.ClassroomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms")
@RequiredArgsConstructor
public class ClassroomController {
    private final ClassroomService classroomService;

    @GetMapping
    public ResponseEntity<List<Classroom>> getAllClassrooms() {
        return ResponseEntity.ok(classroomService.getAllClassrooms());
    }

    @GetMapping("/available")
    public ResponseEntity<List<Classroom>> getAvailableNow() {
        return ResponseEntity.ok(classroomService.getAvailableNow());
    }

    @GetMapping("/unavailable")
    public ResponseEntity<List<Classroom>> getUnavailableNow() {
        return ResponseEntity.ok(classroomService.getUnavailableNow());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<Classroom>> getClassroomsByType(@PathVariable ClassroomType type) {
        return ResponseEntity.ok(classroomService.getClassroomsByType(type));
    }

    @GetMapping("/capacity/{minCapacity}")
    public ResponseEntity<List<Classroom>> getClassroomsByMinCapacity(@PathVariable Integer minCapacity) {
        return ResponseEntity.ok(classroomService.getClassroomsByMinCapacity(minCapacity));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Classroom> getClassroomById(@PathVariable String id) {
        return ResponseEntity.ok(classroomService.getClassroomById(id));
    }

    @PostMapping
    public ResponseEntity<Classroom> createClassroom(@RequestBody Classroom classroom) {
        Classroom createdClassroom = classroomService.createClassroom(classroom);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdClassroom.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdClassroom);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Classroom> updateClassroom(@PathVariable String id, @RequestBody Classroom classroom) {
        return ResponseEntity.ok(classroomService.updateClassroom(id, classroom));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClassroom(@PathVariable String id) {
        classroomService.deleteClassroom(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/check")
    public ResponseEntity<?> checkAvailability(@Valid @RequestBody AvailabilityRequest request) {
        try {
            boolean isAvailable = classroomService.checkAvailability(request);
            return ResponseEntity.ok(Map.of(
                    "available", isAvailable,
                    "message", isAvailable ? "La sala está disponible." : "La sala no está disponible."
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Datos inválidos",
                    "message", e.getMessage()
            ));
        }
    }
}