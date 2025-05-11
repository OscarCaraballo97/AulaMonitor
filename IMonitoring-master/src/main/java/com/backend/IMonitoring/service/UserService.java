package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

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
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    public List<User> getUsersByRole(Rol role) {
        return userRepository.findByRole(role);
    }

    public User createUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    public User updateUser(String id, User user) {
        User existingUser = getUserById(id);
        existingUser.setEmail(user.getEmail());
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            existingUser.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        existingUser.setRole(user.getRole());
        return userRepository.save(existingUser);
    }

    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }

    public List<Reservation> getUserReservations(String userId) {
        return reservationRepository.findByUserId(userId);
    }
}