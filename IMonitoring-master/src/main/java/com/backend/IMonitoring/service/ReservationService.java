package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;


@Service
@RequiredArgsConstructor
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final ClassroomRepository classroomRepository;
    private final UserService userService; 

    public List<Reservation> getAllReservations() {
        return reservationRepository.findAll();
    }

    public Reservation getReservationById(String id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada con ID: " + id));
    }

    public List<Reservation> getReservationsByClassroom(String classroomId) {
        return reservationRepository.findByClassroomId(classroomId);
    }

    public List<Reservation> getReservationsByUser(String userId) {
        return reservationRepository.findByUserId(userId);
    }

    public List<Reservation> getFilteredUserReservations(
            String userId,
            ReservationStatus status,
            String sortDirection,
            String sortField,
            int page,
            int size,
            boolean futureOnly
    ) {
        Sort sortObj = Sort.by(sortDirection.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortField);
        List<Reservation> userReservations = reservationRepository.findByUserId(userId, sortObj);

        Stream<Reservation> stream = userReservations.stream();
        if (status != null) {
            stream = stream.filter(r -> r.getStatus() == status);
        }
        if (futureOnly) {
            stream = stream.filter(r -> r.getStartTime().isAfter(LocalDateTime.now()));
        }
        
        return stream.limit(size).collect(Collectors.toList());
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

    @Transactional
    public Reservation createReservation(Reservation reservation, UserDetails currentUserDetails) {
        if (reservation.getClassroom() == null || reservation.getClassroom().getId() == null) {
            throw new IllegalArgumentException("ID del aula es requerido para crear una reserva.");
        }

        if (!(currentUserDetails instanceof UserDetailsImpl)) {
            throw new IllegalStateException("UserDetails no es del tipo esperado UserDetailsImpl");
        }
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userMakingReservation = userDetailsImpl.getUserEntity();

        if (userMakingReservation == null) {
             throw new IllegalStateException("No se pudo determinar el usuario para la reserva.");
        }
        
        if (reservation.getUser() == null || reservation.getUser().getId() == null ) {
            reservation.setUser(userMakingReservation);
        } else if (userMakingReservation.getRole() == Rol.ADMIN) {
        } else {
            reservation.setUser(userMakingReservation);
        }

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

    @Transactional
    public Reservation updateReservationStatus(String id, ReservationStatus newStatus, UserDetails adminUserDetails) {
        boolean isAdmin = adminUserDetails.getAuthorities().stream()
                            .anyMatch(ga -> ga.getAuthority().equals("ROLE_" + Rol.ADMIN.name()));
        if (!isAdmin) {
            throw new SecurityException("Solo los administradores pueden cambiar el estado de una reserva.");
        }

        Reservation reservation = getReservationById(id);
        if (reservation.getStatus() == ReservationStatus.PENDIENTE &&
            (newStatus == ReservationStatus.CONFIRMADA || newStatus == ReservationStatus.RECHAZADA)) {
            reservation.setStatus(newStatus);
        } else if (newStatus == ReservationStatus.CANCELADA) {
             reservation.setStatus(newStatus);
        }
        else {
            throw new IllegalStateException("Transición de estado no permitida o estado final inválido para esta acción por un Admin.");
        }
        return reservationRepository.save(reservation);
    }

    @Transactional
    public Reservation cancelMyReservation(String reservationId, UserDetails currentUserDetails) {
        Reservation reservation = getReservationById(reservationId);
        if (!(currentUserDetails instanceof UserDetailsImpl)) {
             throw new IllegalStateException("UserDetails no es del tipo esperado UserDetailsImpl");
        }
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userCancelling = userDetailsImpl.getUserEntity();

        if (!Objects.equals(reservation.getUser().getId(), userCancelling.getId()) && userCancelling.getRole() != Rol.ADMIN) {
            throw new SecurityException("No tienes permiso para cancelar esta reserva.");
        }

        if (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) {
            reservation.setStatus(ReservationStatus.CANCELADA); 
            return reservationRepository.save(reservation);
        } else {
            throw new IllegalStateException("Solo se pueden cancelar reservas pendientes o confirmadas.");
        }
    }

    @Transactional
    public void deleteReservation(String reservationId, UserDetails currentUserDetails) { 
        Reservation reservation = getReservationById(reservationId);
         if (!(currentUserDetails instanceof UserDetailsImpl)) {
             throw new IllegalStateException("UserDetails no es del tipo esperado UserDetailsImpl");
        }
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userDeleting = userDetailsImpl.getUserEntity();

        if (userDeleting.getRole() == Rol.ADMIN || Objects.equals(reservation.getUser().getId(), userDeleting.getId())) {
            reservationRepository.deleteById(reservationId); 
        } else {
            throw new SecurityException("No tienes permiso para eliminar esta reserva.");
        }
    }
}
