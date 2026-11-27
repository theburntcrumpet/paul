package dev.paul.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import dev.paul.user.User;
import dev.paul.user.UserService;
import dev.paul.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank String username, @NotNull String password) {}

    public record ChangePasswordRequest(@NotNull String currentPassword, @NotNull String newPassword) {}

    public record Me(long id, String username, boolean mustChangePassword) {
        static Me of(User user) {
            return new Me(user.getId(), user.getUsername(), user.isMustChangePassword());
        }
    }

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final PersistentTokenBasedRememberMeServices rememberMeServices;
    private final PersistentTokenRepository tokenRepository;
    private final UserService userService;

    public AuthController(
            AuthenticationManager authenticationManager,
            SecurityContextRepository securityContextRepository,
            PersistentTokenBasedRememberMeServices rememberMeServices,
            PersistentTokenRepository tokenRepository,
            UserService userService) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.rememberMeServices = rememberMeServices;
        this.tokenRepository = tokenRepository;
        this.userService = userService;
    }

    /** Signs in, starts a fresh session and issues a remember-me cookie for this device. */
    @PostMapping("/login")
    public Me login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password()));
        } catch (AuthenticationException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Incorrect username or password");
        }
        establish(auth, request, response);
        return Me.of(userService.getByUsername(auth.getName()));
    }

    @GetMapping("/me")
    public Me me(Authentication auth) {
        return Me.of(userService.getByUsername(auth.getName()));
    }

    /**
     * Changes the signed-in user's password. Remember-me logins on other devices are revoked;
     * this device gets a new one.
     */
    @PostMapping("/password")
    public Me changePassword(@Valid @RequestBody ChangePasswordRequest body, Authentication auth,
            HttpServletRequest request, HttpServletResponse response) {
        User user = userService.changeOwnPassword(auth.getName(), body.currentPassword(), body.newPassword());
        tokenRepository.removeUserTokens(user.getUsername());
        rememberMeServices.loginSuccess(request, response, auth);
        return Me.of(user);
    }

    private void establish(Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId(); // session-fixation protection
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        rememberMeServices.loginSuccess(request, response, auth);
    }
}
