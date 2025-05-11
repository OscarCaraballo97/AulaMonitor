package com.backend.IMonitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Classroom {
    @Id
    private String id;

    private String name;
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    private ClassroomType type;

    private String resources;

    @ManyToOne
    @JoinColumn(name = "building_id")
    private Building building;
}