package com.backend.IMonitoring.config;

import com.backend.IMonitoring.model.Rol;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity 
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll() 
                .requestMatchers("/api/auth/**").permitAll()

               
                .requestMatchers(HttpMethod.GET, "/api/buildings", "/api/buildings/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/buildings").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.PUT, "/api/buildings/**").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.DELETE, "/api/buildings/**").hasAuthority("ROLE_" + Rol.ADMIN.name())

                
                .requestMatchers(HttpMethod.GET, "/api/classrooms", "/api/classrooms/**", "/api/classrooms/stats/availability").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/classrooms").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.PUT, "/api/classrooms/**").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.DELETE, "/api/classrooms/**").hasAuthority("ROLE_" + Rol.ADMIN.name())

                // Reservas:
                .requestMatchers(HttpMethod.POST, "/api/reservations").authenticated() // Todos los autenticados pueden intentar crear (se pondrá PENDIENTE)
                .requestMatchers(HttpMethod.GET, "/api/reservations", "/api/reservations/**").authenticated() // Todos pueden intentar ver (lógica de servicio filtrará)
                .requestMatchers(HttpMethod.PUT, "/api/reservations/{id}/status").hasAuthority("ROLE_" + Rol.ADMIN.name()) // Solo Admin aprueba/rechaza
                .requestMatchers(HttpMethod.PATCH, "/api/reservations/{id}/status").hasAuthority("ROLE_" + Rol.ADMIN.name()) // Alias para PUT status
                .requestMatchers(HttpMethod.PUT, "/api/reservations/{id}").authenticated() // Dueño de reserva PENDIENTE o Admin puede editar
                .requestMatchers(HttpMethod.DELETE, "/api/reservations/{id}").authenticated() // Dueño de reserva PENDIENTE o Admin puede borrar
                .requestMatchers(HttpMethod.PATCH, "/api/reservations/{id}/cancel").authenticated() // Dueño o Admin pueden cancelar


                .requestMatchers(HttpMethod.GET, "/api/users/me/reservations").authenticated() // Cualquier usuario autenticado puede ver sus propias reservas
                .requestMatchers(HttpMethod.GET, "/api/users/{userId}/reservations").hasAuthority("ROLE_" + Rol.ADMIN.name()) // Admin ve reservas de otros
                .requestMatchers("/api/users/**").hasAuthority("ROLE_" + Rol.ADMIN.name()) // Solo ADMIN gestiona la lista de usuarios

                .anyRequest().authenticated() 
            )
            .sessionManagement(session -> session
                    .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        System.out.println("INFO: [SecurityConfig] Creando bean CorsConfigurationSource para SecurityFilterChain...");
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:8100"
               
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); 

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration); 
        System.out.println("INFO: [SecurityConfig] CorsConfigurationSource configurado para /api/**");
        return source;
    }
}
