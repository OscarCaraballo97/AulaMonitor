package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final ClassroomRepository classroomRepository;

    public List<Reservation> getAllReservations() {
        return reservationRepository.findAll();
    }

    public Reservation getReservationById(String id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));
    }

    public List<Reservation> getReservationsByClassroom(String classroomId) {
        return reservationRepository.findByClassroomId(classroomId);
    }

    public List<Reservation> getReservationsByUser(String userId) {
        return reservationRepository.findByUserId(userId);
    }

    public List<Reservation> getReservationsByStatus(ReservationStatus status) {
        return reservationRepository.findByStatus(status);
    }

    public List<Reservation> getUpcomingReservations() {
        return reservationRepository.findByStartTimeAfter(LocalDateTime.now());
    }

    public List<Reservation> getCurrentReservations() {
        LocalDateTime now = LocalDateTime.now();
        return reservationRepository.findCurrentReservations(now);
    }

    public Reservation createReservation(Reservation reservation) {
        boolean isAvailable = classroomRepository.isAvailable(
                reservation.getClassroom().getId(),
                reservation.getStartTime(),
                reservation.getEndTime()
        );

        if (!isAvailable) {
            throw new RuntimeException("La sala no está disponible en el horario solicitado");
        }

        reservation.setStatus(ReservationStatus.PENDIENTE);
        return reservationRepository.save(reservation);
    }

    public Reservation updateReservationStatus(String id, ReservationStatus status) {
        Reservation reservation = getReservationById(id);
        reservation.setStatus(status);
        return reservationRepository.save(reservation);
    }

    public void deleteReservation(String id) {
        reservationRepository.deleteById(id);
    }
}