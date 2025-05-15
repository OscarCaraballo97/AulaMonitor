package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.repository.BuildingRepository;
import com.backend.IMonitoring.repository.ClassroomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                .orElseThrow(() -> new RuntimeException("Edificio no encontrado con ID: " + id));
    }

    @Transactional
    public Building createBuilding(Building building) {
        return buildingRepository.save(building);
    }

    @Transactional
    public Building updateBuilding(String id, Building buildingDetails) {
        Building building = getBuildingById(id);
        building.setName(buildingDetails.getName());
        building.setLocation(buildingDetails.getLocation());
        return buildingRepository.save(building);
    }

    @Transactional
    public void deleteBuilding(String id) {
           buildingRepository.deleteById(id);
    }

    public List<Classroom> getClassroomsByBuilding(String buildingId) {
        return classroomRepository.findByBuilding_Id(buildingId); 
    }
}
