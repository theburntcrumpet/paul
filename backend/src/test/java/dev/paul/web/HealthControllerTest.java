package dev.paul.web;

import static org.assertj.core.api.Assertions.assertThat;

import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

class HealthControllerTest extends IntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void healthIsPublicAndReportsVersion() {
        assertThat(mvc.get().uri("/api/health"))
                .hasStatusOk()
                .bodyJson()
                .hasPathSatisfying("$.status", s -> s.assertThat().isEqualTo("ok"))
                .hasPathSatisfying("$.version", v -> v.assertThat().isNotNull());
    }

    @Test
    void actuatorHealthIsPublic() {
        assertThat(mvc.get().uri("/actuator/health")).hasStatusOk();
    }

    @Test
    void otherApiEndpointsRequireAuthentication() {
        assertThat(mvc.get().uri("/api/books")).hasStatus(HttpStatus.UNAUTHORIZED);
    }
}
