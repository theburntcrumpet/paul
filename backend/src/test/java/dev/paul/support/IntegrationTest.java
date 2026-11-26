package dev.paul.support;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Base class for full-context tests.
 *
 * <p>All subclasses share one Spring context (and therefore one SQLite database) per test JVM, in
 * a fresh directory under {@code target/test-data}. A JUnit {@code @TempDir} is not used because
 * the cached context keeps the database open, which prevents cleanup on Windows. Tests that need
 * isolation should create their own uniquely named data rather than rely on an empty database.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

    protected static final Path dataDir = createDataDir();

    @DynamicPropertySource
    static void dataDirProperties(DynamicPropertyRegistry registry) {
        registry.add("paul.data-dir", dataDir::toString);
    }

    private static Path createDataDir() {
        try {
            Path root = Files.createDirectories(Path.of("target", "test-data"));
            return Files.createTempDirectory(root, "run-").toAbsolutePath();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
