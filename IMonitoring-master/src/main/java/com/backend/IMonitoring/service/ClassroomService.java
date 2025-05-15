package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.ClassroomAvailabilitySummaryDTO;
import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.BuildingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final BuildingRepository buildingRepository;

    public List<Classroom> getAllClassrooms() {
        return classroomRepository.findAll();
    }

    public Classroom getClassroomById(String id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Aula no encontrada con ID: " + id));
    }

    @Transactional
    public Classroom createClassroom(Classroom classroom) {
        String determinedBuildingId = null;
        if (classroom.getBuilding() != null && classroom.getBuilding().getId() != null) {
            determinedBuildingId = classroom.getBuilding().getId();
        }
        // Si tu entidad Classroom tuviera un campo buildingId directo y lo prefieres:
        // else if (classroom.getBuildingId() != null) { // Asumiendo que Classroom tiene un método getBuildingId()
        //     determinedBuildingId = classroom.getBuildingId();
        // }

        if (determinedBuildingId == null) {
            throw new IllegalArgumentException("Se requiere la asociación a un edificio (a través de building.id o buildingId) para crear un aula.");
        }

        // Usar una variable final para la expresión lambda
        final String finalBuildingIdToFind = determinedBuildingId;
        Building building = buildingRepository.findById(finalBuildingIdToFind)
                .orElseThrow(() -> new RuntimeException("Edificio no encontrado con ID: " + finalBuildingIdToFind + " al crear aula."));
        classroom.setBuilding(building); // Asegura que el objeto Building completo esté asociado

        return classroomRepository.save(classroom);
    }

    @Transactional
    public Classroom updateClassroom(String id, Classroom classroomDetails) {
        Classroom classroomToUpdate = getClassroomById(id);
        classroomToUpdate.setName(classroomDetails.getName());
        classroomToUpdate.setCapacity(classroomDetails.getCapacity());
        classroomToUpdate.setType(classroomDetails.getType());
        classroomToUpdate.setResources(classroomDetails.getResources());

        String newBuildingId = null;
        if (classroomDetails.getBuilding() != null && classroomDetails.getBuilding().getId() != null) {
            newBuildingId = classroomDetails.getBuilding().getId();
        }
        // Si tu entidad Classroom tuviera un campo buildingId directo y lo prefieres:
        // else if (classroomDetails.getBuildingId() != null) { // Asumiendo que Classroom tiene getBuildingId()
        //    newBuildingId = classroomDetails.getBuildingId();
        // }

        if (newBuildingId != null) {
            if (classroomToUpdate.getBuilding() == null || !classroomToUpdate.getBuilding().getId().equals(newBuildingId)) {
                final String finalNewBuildingIdForUpdate = newBuildingId; // Variable final para la lambda
                Building building = buildingRepository.findById(finalNewBuildingIdForUpdate)
                        .orElseThrow(() -> new RuntimeException("Edificio no encontrado con ID: " + finalNewBuildingIdForUpdate + " al actualizar aula."));
                classroomToUpdate.setBuilding(building);
            }
        }
        // else {
        //    // Si se quiere permitir desasociar un edificio, se enviaría un buildingId nulo
        //    // y aquí se pondría classroomToUpdate.setBuilding(null);
        // }

        return classroomRepository.save(classroomToUpdate);
    }

    @Transactional
    public void deleteClassroom(String id) {
        classroomRepository.deleteById(id);
    }

    public List<Classroom> getClassroomsByType(ClassroomType type) {
        return classroomRepository.findByType(type);
    }

    public List<Classroom> getClassroomsByMinCapacity(Integer minCapacity) {
        if (minCapacity == null || minCapacity < 0) {
            throw new IllegalArgumentException("La capacidad mínima debe ser un número positivo.");
        }
        return classroomRepository.findByCapacityGreaterThanEqual(minCapacity);
    }

    public List<Classroom> getAvailableNow() {
        return classroomRepository.findAvailableNow(LocalDateTime.now());
    }

    public List<Classroom> getUnavailableNow() {
        return classroomRepository.findUnavailableNow(LocalDateTime.now());
    }
    
    public boolean checkAvailability(AvailabilityRequest request) {
        if (request == null || request.getClassroomId() == null || request.getStartTime() == null || request.getEndTime() == null) {
            throw new IllegalArgumentException("Datos incompletos para verificar disponibilidad.");
        }
        return classroomRepository.isAvailable(
            request.getClassroomId(),
            request.getStartTime(),
            request.getEndTime()
        );
    }

    public ClassroomAvailabilitySummaryDTO getAvailabilitySummary() {
        LocalDateTime now = LocalDateTime.now();
        List<Classroom> available = classroomRepository.findAvailableNow(now);
        List<Classroom> unavailable = classroomRepository.findUnavailableNow(now);
        long total = classroomRepository.count();
        return new ClassroomAvailabilitySummaryDTO(available.size(), unavailable.size(), (int) total);
    }
}
