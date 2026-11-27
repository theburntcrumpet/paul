package dev.paul.auth;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;

/** JSON bodies for security failures, matching {@code ApiExceptionHandler.ErrorResponse}. */
public final class JsonAuthResponses {

    private JsonAuthResponses() {}

    public static void unauthorized(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException e) throws IOException {
        write(response, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in");
    }

    public static void forbidden(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException e) throws IOException {
        if (e instanceof CsrfException) {
            write(response, HttpStatus.FORBIDDEN, "CSRF", "Your session token is missing or stale; please retry");
        } else {
            write(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not allowed to do that");
        }
    }

    static void write(HttpServletResponse response, HttpStatus status, String code, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
