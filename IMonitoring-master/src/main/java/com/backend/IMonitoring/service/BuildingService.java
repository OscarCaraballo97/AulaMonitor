package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.repository.BuildingRepository;
import com.backend.IMonitoring.repository.ClassroomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BuildingService {
    private final BuildingRepository buildingRepository;
    private final ClassroomRepository classroomRepository;

    public List<Building> getAllBuildings() {
        return buildingRepository.findAll();
    }

    public Building getBuildingById(String id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Edificio no encontrado"));
    }

    public Building createBuilding(Building building) {
        return buildingRepository.save(building);
    }

    public Building updateBuilding(String id, Building building) {
        Building existingBuilding = getBuildingById(id);
        existingBuilding.setName(building.getName());
        existingBuilding.setLocation(building.getLocation());
        return buildingRepository.save(existingBuilding);
    }

    public void deleteBuilding(String id) {
        buildingRepository.deleteById(id);
    }

    public List<Classroom> getClassroomsByBuilding(String buildingId) {
        Building building = getBuildingById(buildingId);
        return building.getClassrooms();
    }
}