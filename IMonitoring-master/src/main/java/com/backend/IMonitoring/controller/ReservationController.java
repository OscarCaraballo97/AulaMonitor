package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.ReservationRequestDTO;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ClassroomService;
import com.backend.IMonitoring.service.ReservationService;
import com.backend.IMonitoring.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class ReservationController {
    private final ReservationService reservationService;
    private final ClassroomService classroomService; 
    private final UserService userService;  

    @GetMapping
    public ResponseEntity<List<Reservation>> getAllReservations(
            @RequestParam(required = false) String classroomId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) ReservationStatus status,
            @AuthenticationPrincipal UserDetails currentUserDetails 
    ) {
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        if (userDetailsImpl.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {

            return ResponseEntity.ok(reservationService.getAdminFilteredReservations(classroomId, userId, status));
        } else {
            
            String currentAuthUserId = userDetailsImpl.getId();
            return ResponseEntity.ok(reservationService.getFilteredUserReservations(currentAuthUserId, status, "asc", "startTime", 0, 100, false));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Reservation> getReservationById(@PathVariable String id) {
        return ResponseEntity.ok(reservationService.getReservationById(id));
    }

    @PostMapping
    public ResponseEntity<Reservation> createReservation(
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO,
            @AuthenticationPrincipal UserDetails currentUserDetails
    ) {
        if (currentUserDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Classroom classroom = classroomService.getClassroomById(reservationRequestDTO.getClassroomId());
        User userToReserveFor;

        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        if (userDetailsImpl.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")) &&
            reservationRequestDTO.getUserId() != null &&
            !reservationRequestDTO.getUserId().isEmpty()) {
            userToReserveFor = userService.getUserById(reservationRequestDTO.getUserId());
        } else {
            userToReserveFor = userDetailsImpl.getUserEntity();
        }

        Reservation newReservation = Reservation.builder()
                .classroom(classroom)
                .user(userToReserveFor)
                .startTime(reservationRequestDTO.getStartTime())
                .endTime(reservationRequestDTO.getEndTime())
                .purpose(reservationRequestDTO.getPurpose())
                .build();

        Reservation createdReservation = reservationService.createReservation(newReservation, currentUserDetails);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdReservation.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdReservation);
    }


    @PutMapping("/{id}/status")
    public ResponseEntity<Reservation> updateReservationStatus(
            @PathVariable String id,
            @RequestParam ReservationStatus status,
            @AuthenticationPrincipal UserDetails adminUserDetails
    ) {
        return ResponseEntity.ok(reservationService.updateReservationStatus(id, status, adminUserDetails));
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<Reservation> updateReservationDetails(
            @PathVariable String id,
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO, 
            @AuthenticationPrincipal UserDetails currentUserDetails
    ) {

        Classroom classroom = classroomService.getClassroomById(reservationRequestDTO.getClassroomId());
        User userForReservation = null;
        if (reservationRequestDTO.getUserId() != null) {
             userForReservation = userService.getUserById(reservationRequestDTO.getUserId());
        }

        Reservation updatedReservationData = Reservation.builder()
            .classroom(classroom)
            .user(userForReservation) 
            .startTime(reservationRequestDTO.getStartTime())
            .endTime(reservationRequestDTO.getEndTime())
            .purpose(reservationRequestDTO.getPurpose())
            .build();


        Reservation updatedReservation = reservationService.updateReservation(id, updatedReservationData, currentUserDetails);
        return ResponseEntity.ok(updatedReservation);
    }


    @PatchMapping("/{id}/cancel")
    public ResponseEntity<Reservation> cancelMyReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails currentUserDetails
    ) {
        return ResponseEntity.ok(reservationService.cancelMyReservation(id, currentUserDetails));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails currentUserDetails
    ) {
        reservationService.deleteReservation(id, currentUserDetails);
        return ResponseEntity.noContent().build();
    }
}
