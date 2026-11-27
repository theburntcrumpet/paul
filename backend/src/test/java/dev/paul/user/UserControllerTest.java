package dev.paul.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import java.util.UUID;

import jakarta.servlet.http.Cookie;

import dev.paul.config.SecurityConfig;
import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class UserControllerTest extends IntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    UserService users;

    String me;
    RequestPostProcessor asMe;

    private static String unique(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }

    @BeforeEach
    void signedInUser() {
        me = unique("me");
        users.create(me, "initial-pass");
        users.changeOwnPassword(me, "initial-pass", "settled-pass");
        asMe = user(me).roles("USER");
    }

    @Test
    void requiresAuthentication() {
        assertThat(mvc.get().uri("/api/users")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void usersWhoMustChangePasswordCannotManageUsers() {
        String pending = unique("pending");
        users.create(pending, "initial-pass");

        assertThat(mvc.get().uri("/api/users").with(user(pending)))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void listsUsersWithoutPasswordHashes() {
        assertThat(mvc.get().uri("/api/users").with(asMe))
                .hasStatusOk()
                .bodyText().contains("\"username\":\"" + me + "\"").doesNotContain("password").doesNotContain("bcrypt");
    }

    @Test
    void createsAUserWhoMustChangeTheirPassword() {
        String name = unique("new");

        assertThat(mvc.post().uri("/api/users").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + name.toUpperCase() + "\",\"password\":\"temp-password\"}"))
                .hasStatus(HttpStatus.CREATED)
                .bodyJson()
                .hasPathSatisfying("$.username", u -> u.assertThat().isEqualTo(name))
                .hasPathSatisfying("$.mustChangePassword", m -> m.assertThat().isEqualTo(true))
                .hasPathSatisfying("$.id", i -> i.assertThat().isNotNull());
    }

    @Test
    void creatingRequiresCsrf() {
        assertThat(mvc.post().uri("/api/users").with(asMe)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"x" + unique("") + "\",\"password\":\"temp-password\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsDuplicateAndInvalidUsers() {
        assertThat(mvc.post().uri("/api/users").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + me + "\",\"password\":\"temp-password\"}"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("USERNAME_TAKEN"));

        assertThat(mvc.post().uri("/api/users").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + unique("ok") + "\",\"password\":\"short\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("INVALID_PASSWORD"));

        assertThat(mvc.post().uri("/api/users").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("VALIDATION"));
    }

    @Test
    void resettingAPasswordForcesAChangeAndSignsThemOutEverywhere() {
        String other = unique("other");
        User user = users.create(other, "initial-pass");
        users.changeOwnPassword(other, "initial-pass", "their-own-pass");

        Cookie theirDevice = mvc.post().uri("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + other + "\",\"password\":\"their-own-pass\"}")
                .exchange().getMvcResult().getResponse().getCookie(SecurityConfig.REMEMBER_ME_COOKIE);
        assertThat(mvc.get().uri("/api/auth/me").cookie(theirDevice)).hasStatusOk();

        assertThat(mvc.post().uri("/api/users/" + user.getId() + "/password").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"temporary-pass\"}"))
                .hasStatusOk()
                .bodyJson().hasPathSatisfying("$.mustChangePassword", m -> m.assertThat().isEqualTo(true));

        assertThat(mvc.get().uri("/api/auth/me").cookie(theirDevice)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void cannotResetYourOwnPasswordThisWay() {
        long myId = users.getByUsername(me).getId();

        assertThat(mvc.post().uri("/api/users/" + myId + "/password").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"temporary-pass\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("CANNOT_RESET_SELF"));
    }

    @Test
    void resettingAnUnknownUserIs404() {
        assertThat(mvc.post().uri("/api/users/" + Long.MAX_VALUE + "/password").with(asMe).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"temporary-pass\"}"))
                .hasStatus(HttpStatus.NOT_FOUND);
    }
}
