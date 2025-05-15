package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.User; // Importa tu entidad User
import com.backend.IMonitoring.security.UserDetailsImpl; // Tu implementación de UserDetails
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class JwtService {

    @Value("${jwt.secret-key}")
    private String base64EncodedSecretKey;

    @Value("${jwt.expiration-time:86400000}")
    private long jwtExpiration;

    public String extractUsername(String token) {
        // ... (como lo tenías)
        try {
            return extractClaim(token, Claims::getSubject);
        } catch (ExpiredJwtException | SignatureException e) {
            System.err.println("Error al extraer username del token (expirado o firma inválida): " + e.getMessage());
            return null;
        } catch (io.jsonwebtoken.io.DecodingException e) {
            System.err.println("Error de decodificación JWT: " + e.getMessage());
            return null;
        }
        catch (Exception e) {
            System.err.println("Error inesperado al extraer username del token: " + e.getMessage());
            return null;
        }
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> extraClaims = new HashMap<>();
        List<String> authorities = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        extraClaims.put("authorities", authorities);

        if (!authorities.isEmpty()) {
            String primaryRole = authorities.get(0).toUpperCase().replace("ROLE_", "");
            extraClaims.put("role", primaryRole);
        }

        // --- AÑADIR ID DEL USUARIO Y NOMBRE AL TOKEN ---
        if (userDetails instanceof UserDetailsImpl) {
            UserDetailsImpl userDetailsImplCasted = (UserDetailsImpl) userDetails;
            User appUser = userDetailsImplCasted.getUserEntity(); // Asume que este método existe
            if (appUser != null) {
                extraClaims.put("userId", appUser.getId()); // <--- AÑADE EL ID DEL USUARIO
                if (appUser.getName() != null) {
                    extraClaims.put("name", appUser.getName());
                }
            }
        }
        // ------------------------------------------

        return generateToken(extraClaims, userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        // ... (como lo tenías)
        return Jwts.builder()
                .claims(extraClaims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSignInKey())
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        // ... (como lo tenías)
         try {
            final String username = extractUsername(token);
            return (username != null && username.equals(userDetails.getUsername())) && !isTokenExpired(token);
        } catch (Exception e) {
            System.err.println("Token inválido o error durante la validación: " + e.getMessage());
            return false;
        }
    }

    private boolean isTokenExpired(String token) {
        // ... (como lo tenías)
        try {
            return extractExpiration(token).before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        // ... (como lo tenías)
        return Jwts.parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSignInKey() {
        // ... (como lo tenías, asegurándote que base64EncodedSecretKey sea válida y larga)
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(this.base64EncodedSecretKey);
        } catch (IllegalArgumentException e) {
            System.err.println("ERROR CRÍTICO: jwt.secret-key en application.properties NO es una cadena Base64 válida: " + e.getMessage());
            System.err.println("Valor problemático de base64EncodedSecretKey: [" + this.base64EncodedSecretKey + "]");
            throw new RuntimeException("La clave secreta JWT está malformada. Verifica application.properties.", e);
        }
        if (keyBytes.length < 32) {
            System.err.println("ERROR CRÍTICO: La clave secreta JWT es demasiado corta después de la decodificación Base64. Se requieren al menos 256 bits (32 bytes). Longitud actual: " + (keyBytes.length * 8) + " bits.");
            throw new IllegalArgumentException("La clave secreta JWT configurada es demasiado corta.");
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
