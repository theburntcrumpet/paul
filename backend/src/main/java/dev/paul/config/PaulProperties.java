package dev.paul.config;

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Application settings, bound from {@code paul.*}.
 *
 * @param dataDir root directory for the SQLite database and all book files
 */
@ConfigurationProperties("paul")
public record PaulProperties(@DefaultValue("./data") Path dataDir) {

    public Path databaseFile() {
        return dataDir.resolve("paul.db");
    }
}
