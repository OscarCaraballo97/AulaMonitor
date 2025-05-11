package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.service.BuildingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/buildings")
@RequiredArgsConstructor
public class BuildingController {
    private final BuildingService buildingService;

    @GetMapping
    public ResponseEntity<List<Building>> getAllBuildings() {
        return ResponseEntity.ok(buildingService.getAllBuildings());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Building> getBuildingById(@PathVariable String id) {
        return ResponseEntity.ok(buildingService.getBuildingById(id));
    }

    @PostMapping
    public ResponseEntity<Building> createBuilding(@RequestBody Building building) {
        Building createdBuilding = buildingService.createBuilding(building);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdBuilding.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdBuilding);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Building> updateBuilding(@PathVariable String id, @RequestBody Building building) {
        return ResponseEntity.ok(buildingService.updateBuilding(id, building));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBuilding(@PathVariable String id) {
        buildingService.deleteBuilding(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/classrooms")
    public ResponseEntity<List<Classroom>> getClassroomsByBuilding(@PathVariable String id) {
        return ResponseEntity.ok(buildingService.getClassroomsByBuilding(id));
    }
}