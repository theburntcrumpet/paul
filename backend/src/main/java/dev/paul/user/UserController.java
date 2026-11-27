package dev.paul.user;

import java.time.Instant;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import dev.paul.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** User management. Every signed-in user may manage users (personal-use app, no roles yet). */
@RestController
@RequestMapping("/api/users")
public class UserController {

    public record UserResponse(long id, String username, boolean mustChangePassword, Instant createdAt) {
        static UserResponse of(User user) {
            return new UserResponse(user.getId(), user.getUsername(), user.isMustChangePassword(), user.getCreatedAt());
        }
    }

    public record CreateUserRequest(@NotNull String username, @NotNull String password) {}

    public record ResetPasswordRequest(@NotNull String password) {}

    private final UserService users;
    private final PersistentTokenRepository tokens;

    public UserController(UserService users, PersistentTokenRepository tokens) {
        this.users = users;
        this.tokens = tokens;
    }

    @GetMapping
    public List<UserResponse> list() {
        return users.list().stream().map(UserResponse::of).toList();
    }

    /** Creates a user with a temporary password they must change at first sign-in. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest body) {
        return UserResponse.of(users.create(body.username(), body.password()));
    }

    /**
     * Sets a temporary password for another user, signs them out of every device and makes them
     * choose a new password at next sign-in.
     */
    @PostMapping("/{id}/password")
    public UserResponse resetPassword(@PathVariable long id, @Valid @RequestBody ResetPasswordRequest body,
            Authentication auth) {
        User target = users.get(id);
        if (target.getUsername().equals(auth.getName())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CANNOT_RESET_SELF",
                    "Use 'Change password' to change your own password");
        }
        User reset = users.resetPassword(id, body.password());
        tokens.removeUserTokens(reset.getUsername());
        return UserResponse.of(reset);
    }
}
