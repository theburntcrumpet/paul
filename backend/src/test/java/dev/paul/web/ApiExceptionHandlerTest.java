package dev.paul.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class ApiExceptionHandlerTest {

    record Payload(@NotBlank String name) {}

    @RestController
    static class TestController {
        @PostMapping("/boom")
        void boom() {
            throw new ApiException(HttpStatus.CONFLICT, "THING_EXISTS", "That thing already exists");
        }

        @PostMapping("/validate")
        void validate(@Valid @RequestBody Payload payload) {}
    }

    private final MockMvcTester mvc = MockMvcTester.of(List.of(new TestController()), builder ->
            builder.setControllerAdvice(new ApiExceptionHandler()).build());

    @Test
    void apiExceptionsBecomeCodeAndMessage() {
        assertThat(mvc.post().uri("/boom"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson()
                .isLenientlyEqualTo("{\"code\":\"THING_EXISTS\",\"message\":\"That thing already exists\"}");
    }

    @Test
    void validationErrorsListTheFields() {
        assertThat(mvc.post().uri("/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("VALIDATION"))
                .hasPathSatisfying("$.fields.name", f -> f.assertThat().isNotNull());
    }

    @Test
    void malformedBodiesAreBadRequests() {
        assertThat(mvc.post().uri("/validate").contentType(MediaType.APPLICATION_JSON).content("{nope"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .hasPathSatisfying("$.code", c -> c.assertThat().isEqualTo("MALFORMED_REQUEST"));
    }
}
