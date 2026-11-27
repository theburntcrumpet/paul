package dev.paul.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;

import dev.paul.config.SecurityProperties;
import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

class AdminBootstrapTest {

    private final UserService userService = mock(UserService.class);
    private final AdminBootstrap bootstrap =
            new AdminBootstrap(userService, new SecurityProperties("s3cret-start", Duration.ofDays(1)));

    @Test
    void createsAdminWhenThereAreNoUsers() {
        when(userService.hasAnyUsers()).thenReturn(false);

        bootstrap.run(new DefaultApplicationArguments());

        verify(userService).createInitial("admin", "s3cret-start");
    }

    @Test
    void doesNothingWhenUsersExist() {
        when(userService.hasAnyUsers()).thenReturn(true);

        bootstrap.run(new DefaultApplicationArguments());

        verify(userService, never()).createInitial(any(), any());
    }

    @Nested
    class OnFirstStart extends IntegrationTest {

        @Autowired
        UserService users;

        @Autowired
        PasswordEncoder passwordEncoder;

        @Test
        void adminExistsWithDefaultPasswordAndMustChangeIt() {
            User admin = users.getByUsername("admin");
            assertThat(admin.isMustChangePassword()).isTrue();
            assertThat(passwordEncoder.matches("admin", admin.getPasswordHash())).isTrue();
        }
    }
}
