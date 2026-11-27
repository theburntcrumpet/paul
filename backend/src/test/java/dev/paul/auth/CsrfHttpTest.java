package dev.paul.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import dev.paul.config.SecurityConfig;
import dev.paul.support.IntegrationTest;
import dev.paul.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Exercises CSRF and cookies through a real HTTP server and a cookie-keeping client, the way a
 * browser does: the SPA reads {@code XSRF-TOKEN} and echoes it in {@code X-XSRF-TOKEN}. MockMvc's
 * {@code csrf()} helper bypasses exactly this, so it is tested here instead.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CsrfHttpTest {

    @DynamicPropertySource
    static void dataDir(DynamicPropertyRegistry registry) {
        registry.add("paul.data-dir", IntegrationTest.dataDir::toString);
    }

    @Value("${local.server.port}")
    int port;

    @Autowired
    UserService users;

    CookieManager cookies;
    HttpClient client;
    String username;

    @BeforeEach
    void setUp() {
        cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        client = HttpClient.newBuilder().cookieHandler(cookies).build();
        username = "csrf" + UUID.randomUUID().toString().substring(0, 8);
        users.create(username, "first-password");
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String json, boolean sendCsrfHeader) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        if (sendCsrfHeader) {
            cookie("XSRF-TOKEN").ifPresent(c -> request.header("X-XSRF-TOKEN", c.getValue()));
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private java.util.Optional<HttpCookie> cookie(String name) {
        return cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals(name)).findFirst();
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private String credentials() {
        return "{\"username\":\"" + username + "\",\"password\":\"first-password\"}";
    }

    @Test
    void firstRequestHandsOutAReadableCsrfCookie() throws Exception {
        HttpResponse<String> response = get("/api/auth/me");

        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(cookie("XSRF-TOKEN")).hasValueSatisfying(c -> assertThat(c.isHttpOnly()).isFalse());
    }

    @Test
    void loginSucceedsWhenTheCookieIsEchoedInTheHeader() throws Exception {
        get("/api/auth/me");

        HttpResponse<String> login = post("/api/auth/login", credentials(), true);

        assertThat(login.statusCode()).isEqualTo(200);
        assertThat(login.body()).contains("\"username\":\"" + username + "\"");
        assertThat(cookie(SecurityConfig.REMEMBER_ME_COOKIE)).hasValueSatisfying(c -> assertThat(c.isHttpOnly()).isTrue());
        assertThat(get("/api/auth/me").statusCode()).isEqualTo(200);
    }

    @Test
    void loginFailsWithoutTheHeaderEvenIfTheCookieIsPresent() throws Exception {
        get("/api/auth/me");
        assertThat(cookie("XSRF-TOKEN")).isPresent();

        HttpResponse<String> login = post("/api/auth/login", credentials(), false);

        assertThat(login.statusCode()).isEqualTo(403);
        assertThat(login.body()).contains("\"code\":\"CSRF\"");
    }

    @Test
    void rememberMeSurvivesLosingTheSession() throws Exception {
        get("/api/auth/me");
        post("/api/auth/login", credentials(), true);

        // Simulate closing the browser: session cookies go, persistent cookies stay.
        java.util.List<HttpCookie> sessionCookies = cookies.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals("JSESSIONID"))
                .toList();
        assertThat(sessionCookies).isNotEmpty();
        sessionCookies.forEach(c -> cookies.getCookieStore().remove(null, c));
        assertThat(cookie("JSESSIONID")).isEmpty();

        assertThat(get("/api/auth/me").statusCode()).isEqualTo(200);
    }
}
