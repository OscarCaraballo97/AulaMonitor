package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface ClassroomRepository extends JpaRepository<Classroom, String> {
    List<Classroom> findByType(ClassroomType type);
    List<Classroom> findByCapacityGreaterThanEqual(Integer minCapacity);

    @Query("SELECT c FROM Classroom c WHERE c NOT IN " +
            "(SELECT r.classroom FROM Reservation r WHERE " +
            "r.status = 'CONFIRMADA' AND " +
            "(r.startTime < CURRENT_TIMESTAMP AND r.endTime > CURRENT_TIMESTAMP))")
    List<Classroom> findAvailableNow();

    @Query("SELECT c FROM Classroom c WHERE c IN " +
            "(SELECT r.classroom FROM Reservation r WHERE " +
            "r.status = 'CONFIRMADA' AND " +
            "(r.startTime < CURRENT_TIMESTAMP AND r.endTime > CURRENT_TIMESTAMP))")
    List<Classroom> findUnavailableNow();

    @Query("SELECT CASE WHEN COUNT(r) = 0 THEN true ELSE false END " +
            "FROM Reservation r WHERE " +
            "r.classroom.id = :classroomId AND " +
            "r.status = 'CONFIRMADA' AND " +
            "(r.startTime < :endTime AND r.endTime > :startTime)")
    boolean isAvailable(
            @Param("classroomId") String classroomId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );
}