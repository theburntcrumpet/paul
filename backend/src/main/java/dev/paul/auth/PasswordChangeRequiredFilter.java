package dev.paul.auth;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import dev.paul.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Blocks every API call except the ones needed to change the password while the signed-in user
 * still has to replace an initial or reset password. The flag is read from the database on each
 * request so a reset takes effect immediately, even for existing sessions.
 */
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    static final Set<String> ALLOWED = Set.of(
            "/api/auth/me", "/api/auth/password", "/api/auth/logout", "/api/auth/login", "/api/health");

    private final UserRepository users;

    public PasswordChangeRequiredFilter(UserRepository users) {
        this.users = users;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith("/api/") || ALLOWED.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)
                && users.findByUsername(auth.getName()).map(u -> u.isMustChangePassword()).orElse(false)) {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"code\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"Please choose a new password to continue\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
