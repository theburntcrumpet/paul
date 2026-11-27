package dev.paul.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.rememberme.InvalidCookieException;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;

/**
 * Persistent remember-me where each device has its own token series. Spring's default logout
 * deletes <em>every</em> token for the user, which would sign you out on your laptop when you
 * sign out on your phone; this only forgets the device that signed out.
 */
public class DeviceRememberMeServices extends PersistentTokenBasedRememberMeServices {

    private final JdbcTemplate jdbc;

    public DeviceRememberMeServices(String key, UserDetailsService userDetailsService,
            PersistentTokenRepository tokenRepository, JdbcTemplate jdbc) {
        super(key, userDetailsService, tokenRepository);
        this.jdbc = jdbc;
    }

    @Override
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        String series = currentSeries(request);
        if (series != null) {
            jdbc.update("DELETE FROM persistent_logins WHERE series = ?", series);
        }
        cancelCookie(request, response);
    }

    private String currentSeries(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (getCookieName().equals(cookie.getName()) && !cookie.getValue().isEmpty()) {
                try {
                    String[] parts = decodeCookie(cookie.getValue());
                    return parts.length == 2 ? parts[0] : null;
                } catch (InvalidCookieException e) {
                    return null;
                }
            }
        }
        return null;
    }
}
