package dev.paul.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import java.util.UUID;

import jakarta.servlet.http.Cookie;

import dev.paul.config.SecurityConfig;
import dev.paul.support.IntegrationTest;
import dev.paul.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class AuthFlowTest extends IntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    UserService users;

    String username;

    @BeforeEach
    void createUser() {
        username = "auth" + UUID.randomUUID().toString().substring(0, 8);
        users.create(username, "first-password");
    }

    private void clearForcedChange() {
        users.changeOwnPassword(username, "first-password", "second-password");
    }

    private MvcTestResult login(String user, String password) {
        return mvc.post().uri("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + user + "\",\"password\":\"" + password + "\"}")
                .exchange();
    }

    private static MockHttpSession session(MvcTestResult result) {
        return (MockHttpSession) result.getMvcResult().getRequest().getSession(false);
    }

    private static Cookie rememberMe(MvcTestResult result) {
        return result.getMvcResult().getResponse().getCookie(SecurityConfig.REMEMBER_ME_COOKIE);
    }

    @Test
    void meRequiresAuthentication() {
        assertThat(mvc.get().uri("/api/auth/me")).hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("UNAUTHENTICATED"));
    }

    @Test
    void loginWithoutCsrfTokenIsRejected() {
        assertThat(mvc.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"first-password\"}"))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("CSRF"));
    }

    @Test
    void wrongPasswordAndUnknownUserGiveTheSameError() {
        for (MvcTestResult result : new MvcTestResult[] {login(username, "nope-nope"), login("ghost", "first-password")}) {
            assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED)
                    .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("BAD_CREDENTIALS"));
        }
    }

    @Test
    void loginIsCaseInsensitiveAndReturnsTheUser() {
        clearForcedChange();
        MvcTestResult result = login(username.toUpperCase(), "second-password");

        assertThat(result).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.username", u -> u.assertThat().isEqualTo(username))
                .hasPathSatisfying("$.mustChangePassword", m -> m.assertThat().isEqualTo(false));
    }

    @Test
    void sessionFromLoginAuthenticatesLaterRequests() {
        clearForcedChange();
        MockHttpSession session = session(login(username, "second-password"));

        assertThat(mvc.get().uri("/api/auth/me").session(session)).hasStatusOk()
                .bodyJson().hasPathSatisfying("$.username", u -> u.assertThat().isEqualTo(username));
    }

    @Test
    void rememberMeCookieAloneSignsTheUserBackIn() {
        clearForcedChange();
        Cookie cookie = rememberMe(login(username, "second-password"));
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getMaxAge()).isEqualTo(90 * 24 * 60 * 60);

        // A brand-new browser session that only has the remember-me cookie.
        assertThat(mvc.get().uri("/api/auth/me").cookie(cookie)).hasStatusOk()
                .bodyJson().hasPathSatisfying("$.username", u -> u.assertThat().isEqualTo(username));
    }

    @Test
    void usersWithInitialPasswordCanOnlyChangeIt() {
        MvcTestResult login = login(username, "first-password");
        assertThat(login).hasStatusOk()
                .bodyJson().hasPathSatisfying("$.mustChangePassword", m -> m.assertThat().isEqualTo(true));
        MockHttpSession session = session(login);

        assertThat(mvc.get().uri("/api/auth/me").session(session)).hasStatusOk();
        assertThat(mvc.get().uri("/api/books").session(session))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("PASSWORD_CHANGE_REQUIRED"));

        assertThat(mvc.post().uri("/api/auth/password").session(session).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"first-password\",\"newPassword\":\"chosen-password\"}"))
                .hasStatusOk()
                .bodyJson().hasPathSatisfying("$.mustChangePassword", m -> m.assertThat().isEqualTo(false));

        // No longer blocked: an unknown API path now falls through to a plain 404.
        assertThat(mvc.get().uri("/api/books").session(session)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void wrongCurrentPasswordIsRejected() {
        MockHttpSession session = session(login(username, "first-password"));

        assertThat(mvc.post().uri("/api/auth/password").session(session).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong-one\",\"newPassword\":\"chosen-password\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("WRONG_PASSWORD"));
    }

    @Test
    void changingPasswordRevokesOtherDevicesRememberMe() {
        clearForcedChange();
        Cookie otherDevice = rememberMe(login(username, "second-password"));
        MvcTestResult thisDevice = login(username, "second-password");

        MvcTestResult change = mvc.post().uri("/api/auth/password").session(session(thisDevice)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"second-password\",\"newPassword\":\"third-password\"}")
                .exchange();
        assertThat(change).hasStatusOk();

        assertThat(mvc.get().uri("/api/auth/me").cookie(otherDevice)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/auth/me").cookie(rememberMe(change))).hasStatusOk();
    }

    @Test
    void logoutEndsTheSessionAndForgetsOnlyThisDevice() {
        clearForcedChange();
        Cookie otherDevice = rememberMe(login(username, "second-password"));
        MvcTestResult login = login(username, "second-password");
        MockHttpSession session = session(login);
        Cookie cookie = rememberMe(login);

        MvcTestResult logout = mvc.post().uri("/api/auth/logout").session(session).cookie(cookie).with(csrf()).exchange();
        assertThat(logout).hasStatusOk();
        assertThat(rememberMe(logout).getMaxAge()).isZero();

        assertThat(mvc.get().uri("/api/auth/me").session(session)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/auth/me").cookie(cookie)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/auth/me").cookie(otherDevice)).hasStatusOk();
    }

    @Test
    void logoutWithoutOrWithAGarbledRememberMeCookieStillSucceeds() {
        clearForcedChange();
        MockHttpSession session = session(login(username, "second-password"));

        assertThat(mvc.post().uri("/api/auth/logout").session(session).with(csrf())).hasStatusOk();

        MockHttpSession another = session(login(username, "second-password"));
        assertThat(mvc.post().uri("/api/auth/logout").session(another).with(csrf())
                        .cookie(new Cookie(SecurityConfig.REMEMBER_ME_COOKIE, "not-base64!")))
                .hasStatusOk();
    }

    @Test
    void loginRejectsMissingFields() {
        assertThat(mvc.post().uri("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("VALIDATION"));
    }
}
