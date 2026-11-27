package dev.paul.user;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import dev.paul.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User accounts. Usernames are case-insensitive (stored lower-case). Every user can see all books
 * and manage other users; there are no roles yet.
 */
@Service
@Transactional
public class UserService {

    public static final int MIN_PASSWORD_LENGTH = 8;
    public static final int MAX_PASSWORD_LENGTH = 128;
    private static final Pattern USERNAME = Pattern.compile("^[a-z0-9][a-z0-9._-]{1,31}$");

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /** Creates a user who must choose a new password at first login. */
    public User create(String rawUsername, String password) {
        String username = normaliseUsername(rawUsername);
        validatePassword(password);
        if (users.existsByUsername(username)) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username '" + username + "' is already taken");
        }
        return users.save(new User(username, passwordEncoder.encode(password), true));
    }

    /**
     * Creates the first-start account. The configured initial password (default {@code admin}) is
     * exempt from the length rules because it must be replaced at first login.
     */
    User createInitial(String rawUsername, String initialPassword) {
        String username = normaliseUsername(rawUsername);
        if (initialPassword == null || initialPassword.isBlank()) {
            throw new IllegalStateException("paul.security.initial-admin-password must not be blank");
        }
        return users.save(new User(username, passwordEncoder.encode(initialPassword), true));
    }

    @Transactional(readOnly = true)
    public List<User> list() {
        return users.findAllByOrderByUsernameAsc();
    }

    @Transactional(readOnly = true)
    public User get(long id) {
        return users.findById(id).orElseThrow(() -> notFound());
    }

    @Transactional(readOnly = true)
    public User getByUsername(String username) {
        return users.findByUsername(username.toLowerCase(Locale.ROOT)).orElseThrow(() -> notFound());
    }

    @Transactional(readOnly = true)
    public boolean hasAnyUsers() {
        return users.count() > 0;
    }

    /** The user changes their own password; clears the forced-change flag. */
    public User changeOwnPassword(String username, String currentPassword, String newPassword) {
        User user = getByUsername(username);
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PASSWORD", "Current password is incorrect");
        }
        validatePassword(newPassword);
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED",
                    "New password must be different from the current one");
        }
        user.setPassword(passwordEncoder.encode(newPassword), false);
        return user;
    }

    /** Someone else resets a user's password; that user must change it at next login. */
    public User resetPassword(long id, String newPassword) {
        User user = get(id);
        validatePassword(newPassword);
        user.setPassword(passwordEncoder.encode(newPassword), true);
        return user;
    }

    static String normaliseUsername(String raw) {
        String username = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (!USERNAME.matcher(username).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USERNAME",
                    "Username must be 2–32 characters: letters, digits, '.', '_' or '-', starting with a letter or digit");
        }
        return username;
    }

    static void validatePassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD",
                    "Password must be between " + MIN_PASSWORD_LENGTH + " and " + MAX_PASSWORD_LENGTH + " characters");
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");
    }
}
