package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Classroom;
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
        return reservationRepository.findAll(Sort.by(Sort.Direction.DESC, "startTime"));
    }

    public List<Reservation> getAdminFilteredReservations(String classroomId, String userId, ReservationStatus status) {
        if (status != null) {
            return reservationRepository.findByStatus(status);
        }
        if (userId != null) {
            return reservationRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "startTime"));
        }
        if (classroomId != null) {
            return reservationRepository.findByClassroomId(classroomId);
        }
        return getAllReservations();
    }

    public Reservation getReservationById(String id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada con ID: " + id));
    }

    public List<Reservation> getReservationsByClassroom(String classroomId) {
        return reservationRepository.findByClassroomId(classroomId);
    }

    public List<Reservation> getReservationsByUser(String userId) {
        return reservationRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "startTime"));
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
        List<Reservation> userReservations;
        if (status != null) {
            userReservations = reservationRepository.findByUserId(userId, sortObj);
            Stream<Reservation> stream = userReservations.stream().filter(r -> r.getStatus() == status);
            if (futureOnly) {
                stream = stream.filter(r -> r.getStartTime().isAfter(LocalDateTime.now()));
            }
            return stream.limit(size).collect(Collectors.toList());
        } else {
            userReservations = reservationRepository.findByUserId(userId, sortObj);
            Stream<Reservation> stream = userReservations.stream();
            if (futureOnly) {
                stream = stream.filter(r -> r.getStartTime().isAfter(LocalDateTime.now()));
            }
            return stream.limit(size).collect(Collectors.toList());
        }
    }

    public List<Reservation> getReservationsByStatus(ReservationStatus status) {
        return reservationRepository.findByStatus(status);
    }

     public List<Reservation> getUpcomingReservations(int limit) {
        return reservationRepository.findByStartTimeAfter(LocalDateTime.now(), Sort.by(Sort.Direction.ASC, "startTime"))
                                    .stream().limit(limit).collect(Collectors.toList());
    }
    
    public List<Reservation> getMyUpcomingReservations(String userId, int limit) {
        Sort sort = Sort.by(Sort.Direction.ASC, "startTime");
        return reservationRepository.findUpcomingConfirmedByUserId(userId, LocalDateTime.now(), sort)
                                    .stream().limit(limit).collect(Collectors.toList());
    }

    public List<Reservation> getCurrentReservations() {
        LocalDateTime now = LocalDateTime.now();
        return reservationRepository.findCurrentReservations(now);
    }

    @Transactional
    public Reservation createReservation(Reservation reservationInput, UserDetails currentUserDetails) {
        if (reservationInput.getClassroom() == null || reservationInput.getClassroom().getId() == null) {
            throw new IllegalArgumentException("ID del aula es requerido para crear una reserva.");
        }
        Classroom classroom = classroomRepository.findById(reservationInput.getClassroom().getId())
            .orElseThrow(() -> new RuntimeException("Aula no encontrada con ID: " + reservationInput.getClassroom().getId()));
        reservationInput.setClassroom(classroom);

        if (!(currentUserDetails instanceof UserDetailsImpl)) {
            throw new IllegalStateException("UserDetails no es del tipo esperado UserDetailsImpl");
        }
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userMakingReservation = userDetailsImpl.getUserEntity();

        if (userMakingReservation == null) {
             throw new IllegalStateException("No se pudo determinar el usuario para la reserva.");
        }
        
        if (userMakingReservation.getRole() == Rol.ADMIN && reservationInput.getUser() != null && reservationInput.getUser().getId() != null) {
            User userToAssign = userService.getUserById(reservationInput.getUser().getId());
            reservationInput.setUser(userToAssign);
        } else {
            reservationInput.setUser(userMakingReservation);
        }

        boolean isAvailable = classroomRepository.isAvailable(
                reservationInput.getClassroom().getId(),
                reservationInput.getStartTime(),
                reservationInput.getEndTime()
        );

        if (!isAvailable) {
            throw new RuntimeException("La sala no está disponible en el horario solicitado: " +
                reservationInput.getClassroom().getName() + " de " +
                reservationInput.getStartTime() + " a " + reservationInput.getEndTime());
        }

        reservationInput.setStatus(ReservationStatus.PENDIENTE);
        System.out.println("ReservationService: Guardando reserva: " + reservationInput);
        return reservationRepository.save(reservationInput);
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
        } else if (newStatus == ReservationStatus.CANCELADA &&
                   (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA)) {
             reservation.setStatus(newStatus);
        }
        else {
            throw new IllegalStateException("Transición de estado no permitida (" + reservation.getStatus() + " -> " + newStatus + ") o estado final inválido para esta acción por un Admin.");
        }
        return reservationRepository.save(reservation);
    }

    @Transactional
    public Reservation updateReservation(String reservationId, Reservation updatedReservationData, UserDetails currentUserDetails) {
        Reservation existingReservation = getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userUpdating = userDetailsImpl.getUserEntity();

        if (!userUpdating.getRole().equals(Rol.ADMIN) && !Objects.equals(existingReservation.getUser().getId(), userUpdating.getId())) {
            throw new SecurityException("No tienes permiso para modificar esta reserva.");
        }
        if (!userUpdating.getRole().equals(Rol.ADMIN) && existingReservation.getStatus() != ReservationStatus.PENDIENTE) {
            throw new IllegalStateException("Solo puedes modificar tus propias reservas si están en estado PENDIENTE.");
        }

        existingReservation.setStartTime(updatedReservationData.getStartTime());
        existingReservation.setEndTime(updatedReservationData.getEndTime());
        existingReservation.setPurpose(updatedReservationData.getPurpose());

        if (userUpdating.getRole().equals(Rol.ADMIN)) {
            if (updatedReservationData.getClassroom() != null && updatedReservationData.getClassroom().getId() != null &&
                !Objects.equals(existingReservation.getClassroom().getId(), updatedReservationData.getClassroom().getId())) {
                Classroom newClassroom = classroomRepository.findById(updatedReservationData.getClassroom().getId())
                    .orElseThrow(() -> new RuntimeException("Aula no encontrada con ID: " + updatedReservationData.getClassroom().getId()));
                existingReservation.setClassroom(newClassroom);
            }
            if (updatedReservationData.getUser() != null && updatedReservationData.getUser().getId() != null &&
                !Objects.equals(existingReservation.getUser().getId(), updatedReservationData.getUser().getId())) {
                User newUser = userService.getUserById(updatedReservationData.getUser().getId());
                existingReservation.setUser(newUser);
            }
            if (updatedReservationData.getStatus() != null) {
                existingReservation.setStatus(updatedReservationData.getStatus());
            }
        }

        boolean isAvailable = classroomRepository.isAvailable(
                existingReservation.getClassroom().getId(),
                existingReservation.getStartTime(),
                existingReservation.getEndTime(),
                existingReservation.getId()
        );
        if (!isAvailable) {
            throw new RuntimeException("La sala no está disponible en el nuevo horario solicitado.");
        }
        return reservationRepository.save(existingReservation);
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
            throw new IllegalStateException("Solo se pueden cancelar reservas pendientes o confirmadas. Estado actual: " + reservation.getStatus());
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
