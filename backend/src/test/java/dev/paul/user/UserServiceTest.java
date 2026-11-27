package dev.paul.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import dev.paul.support.IntegrationTest;
import dev.paul.web.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserServiceTest extends IntegrationTest {

    @Autowired
    UserService users;

    @Autowired
    PasswordEncoder passwordEncoder;

    private static String uniqueName() {
        return "u" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void createsUserWithHashedPasswordWhoMustChangeIt() {
        String name = uniqueName();
        User user = users.create("  " + name.toUpperCase() + " ", "correct horse");

        assertThat(user.getId()).isNotNull();
        assertThat(user.getUsername()).isEqualTo(name);
        assertThat(user.isMustChangePassword()).isTrue();
        assertThat(user.getPasswordHash()).startsWith("{bcrypt}").doesNotContain("correct horse");
        assertThat(passwordEncoder.matches("correct horse", user.getPasswordHash())).isTrue();
        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(users.getByUsername(name.toUpperCase()).getId()).isEqualTo(user.getId());
    }

    @Test
    void rejectsDuplicateUsernamesCaseInsensitively() {
        String name = uniqueName();
        users.create(name, "password1");

        assertThatThrownBy(() -> users.create(name.toUpperCase(), "password2"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getCode()).isEqualTo("USERNAME_TAKEN");
                });
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"a", "-leading", "has space", "émile", "waaaaaaaaaaaaaaaaaaaaaaaytoolongname"})
    void rejectsInvalidUsernames(String name) {
        assertThatThrownBy(() -> users.create(name, "password1"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INVALID_USERNAME"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"jo", "jo.smith", "jo_smith-2", "a1"})
    void acceptsValidUsernames(String name) {
        assertThat(UserService.normaliseUsername(name)).isEqualTo(name);
    }

    @Test
    void rejectsPasswordsOutsideLengthLimits() {
        assertThatThrownBy(() -> users.create(uniqueName(), "short"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INVALID_PASSWORD"));
        assertThatThrownBy(() -> users.create(uniqueName(), "x".repeat(129)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INVALID_PASSWORD"));
        assertThatThrownBy(() -> users.create(uniqueName(), null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void initialAccountMayUseAShortDefaultButNotABlankOne() {
        User user = users.createInitial(uniqueName(), "admin");
        assertThat(user.isMustChangePassword()).isTrue();

        assertThatThrownBy(() -> users.createInitial(uniqueName(), " "))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void changingOwnPasswordClearsTheForcedChangeFlag() {
        String name = uniqueName();
        users.create(name, "initial-pass");

        User changed = users.changeOwnPassword(name, "initial-pass", "brand-new-pass");

        assertThat(changed.isMustChangePassword()).isFalse();
        assertThat(passwordEncoder.matches("brand-new-pass", users.getByUsername(name).getPasswordHash())).isTrue();
    }

    @Test
    void changingOwnPasswordRequiresTheCurrentPassword() {
        String name = uniqueName();
        users.create(name, "initial-pass");

        assertThatThrownBy(() -> users.changeOwnPassword(name, "wrong-pass", "brand-new-pass"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("WRONG_PASSWORD"));
        assertThatThrownBy(() -> users.changeOwnPassword(name, null, "brand-new-pass"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("WRONG_PASSWORD"));
    }

    @Test
    void changingOwnPasswordMustActuallyChangeIt() {
        String name = uniqueName();
        users.create(name, "initial-pass");

        assertThatThrownBy(() -> users.changeOwnPassword(name, "initial-pass", "initial-pass"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("PASSWORD_UNCHANGED"));
    }

    @Test
    void resetPasswordForcesAChangeAtNextLogin() {
        String name = uniqueName();
        User user = users.create(name, "initial-pass");
        users.changeOwnPassword(name, "initial-pass", "chosen-pass");

        User reset = users.resetPassword(user.getId(), "temporary-pass");

        assertThat(reset.isMustChangePassword()).isTrue();
        assertThat(passwordEncoder.matches("temporary-pass", reset.getPasswordHash())).isTrue();
    }

    @Test
    void unknownUsersAreNotFound() {
        assertThatThrownBy(() -> users.get(Long.MAX_VALUE))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> users.getByUsername("nobody-here"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("USER_NOT_FOUND"));
    }

    @Test
    void listsUsersAlphabetically() {
        assertThat(users.list()).extracting(User::getUsername).isSorted().contains("admin");
    }
}
