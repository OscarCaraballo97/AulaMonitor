package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.repository.ReservationRepository; 
import com.backend.IMonitoring.model.Reservation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ReservationRepository reservationRepository; 

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con ID: " + id));
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public List<User> getUsersByRole(Rol role) {
        return userRepository.findByRole(role);
    }

    @Transactional
    public User createUser(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new IllegalArgumentException("El correo electrónico '" + user.getEmail() + "' ya está registrado.");
        }
        if (user.getPassword() != null && !user.getPassword().startsWith("$2a$")) {
             user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        return userRepository.save(user);
    }

    @Transactional
    public User updateUser(String id, User userDetails) {
        User user = getUserById(id);
        if (userDetails.getEmail() != null && !user.getEmail().equals(userDetails.getEmail())) {
            Optional<User> existingUserWithNewEmail = userRepository.findByEmail(userDetails.getEmail());
            if (existingUserWithNewEmail.isPresent() && !existingUserWithNewEmail.get().getId().equals(user.getId())) {
                throw new IllegalArgumentException("El nuevo correo electrónico '" + userDetails.getEmail() + "' ya está en uso por otro usuario.");
            }
            user.setEmail(userDetails.getEmail());
        }
        if (userDetails.getName() != null) {
            user.setName(userDetails.getName());
        }
        if (userDetails.getRole() != null) {
            user.setRole(userDetails.getRole());
        }
        if (userDetails.getPassword() != null && !userDetails.getPassword().isEmpty()) {
            if (!userDetails.getPassword().startsWith("$2a$")) {
                user.setPassword(passwordEncoder.encode(userDetails.getPassword()));
            } else {
                user.setPassword(userDetails.getPassword());
            }
        }
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(String id) {
        User userToDelete = getUserById(id);

        List<Reservation> userReservations = reservationRepository.findByUserId(id);
        if (userReservations != null && !userReservations.isEmpty()) {
            reservationRepository.deleteAll(userReservations);

        }

        userRepository.delete(userToDelete);
    }

    public List<Reservation> getUserReservations(String userId) {
        return reservationRepository.findByUserId(userId);
    }
}
