package dev.paul.web;

import java.util.Optional;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final String version;

    public HealthController(ObjectProvider<BuildProperties> buildProperties) {
        this.version = Optional.ofNullable(buildProperties.getIfAvailable())
                .map(BuildProperties::getVersion)
                .orElse("dev");
    }

    @GetMapping
    public HealthResponse health() {
        return new HealthResponse("ok", version);
    }

    public record HealthResponse(String status, String version) {}
}
