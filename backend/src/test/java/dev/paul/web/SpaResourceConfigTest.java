package dev.paul.web;

import static org.assertj.core.api.Assertions.assertThat;

import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

class SpaResourceConfigTest extends IntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @ParameterizedTest
    @ValueSource(strings = {"/books", "/books/42/edit", "/settings/users"})
    void clientRoutesServeIndex(String path) {
        assertThat(mvc.get().uri(path))
                .hasStatusOk()
                .hasContentTypeCompatibleWith(MediaType.TEXT_HTML)
                .bodyText().contains("Paul");
    }

    @Test
    void rootIsServedByWelcomePage() {
        assertThat(mvc.get().uri("/")).hasStatusOk().hasForwardedUrl("index.html");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/assets/missing.js", "/favicon.ico", "/books/42/cover.png"})
    void missingStaticFilesReturn404(String path) {
        assertThat(mvc.get().uri(path)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void unknownApiPathsAreNotRewritten() {
        // Unauthenticated, so security rejects before routing; must not be swallowed by the SPA.
        assertThat(mvc.get().uri("/api/does-not-exist")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @CsvSource({
        "books/42/edit, true",
        "'', true",
        "api, false",
        "api/books, false",
        "actuator/health, false",
        "assets/app.js, false",
        "v1.2/thing, true"
    })
    void classifiesClientRoutes(String path, boolean expected) {
        assertThat(SpaResourceConfig.SpaFallbackResolver.isClientRoute(path)).isEqualTo(expected);
    }
}
