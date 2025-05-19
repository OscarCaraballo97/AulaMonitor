package com.backend.IMonitoring.repository;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, String> {

    List<Reservation> findByClassroomId(String classroomId);

    List<Reservation> findByUserId(String userId);

    List<Reservation> findByUserId(String userId, Sort sort);

    List<Reservation> findByStatus(ReservationStatus status);

    List<Reservation> findByStartTimeAfter(LocalDateTime dateTime, Sort sort);

    @Query("SELECT r FROM Reservation r WHERE " +
           "r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA AND " +
           "r.startTime <= :now AND r.endTime >= :now")
    List<Reservation> findCurrentReservations(@Param("now") LocalDateTime now);

    @Query("SELECT r FROM Reservation r WHERE r.user.id = :userId AND r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA AND r.startTime > :now")
    List<Reservation> findUpcomingConfirmedByUserId(@Param("userId") String userId, @Param("now") LocalDateTime now, Sort sort);

    @Query("SELECT r FROM Reservation r WHERE r.classroom.id = :classroomId " +
           "AND r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA " +
           "AND r.startTime < :endDate AND r.endTime > :startDate")
    List<Reservation> findByClassroomIdAndDateTimeRange(
            @Param("classroomId") String classroomId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );
}
