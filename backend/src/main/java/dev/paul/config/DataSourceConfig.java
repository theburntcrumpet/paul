package dev.paul.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * SQLite data source living in {@link PaulProperties#dataDir()}.
 *
 * <p>WAL mode allows concurrent readers alongside a single writer; the busy timeout makes writers
 * wait rather than fail when another write is in progress. When moving to a server database,
 * replace this bean with standard {@code spring.datasource.*} configuration.
 */
@Configuration(proxyBeanMethods = false)
public class DataSourceConfig {

    @Bean
    public DataSource dataSource(PaulProperties properties) {
        try {
            Files.createDirectories(properties.dataDir());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create data directory " + properties.dataDir(), e);
        }
        HikariConfig config = new HikariConfig();
        config.setPoolName("paul-sqlite");
        config.setJdbcUrl("jdbc:sqlite:" + properties.databaseFile().toAbsolutePath()
                + "?journal_mode=WAL&busy_timeout=5000&foreign_keys=true&synchronous=NORMAL");
        config.setMaximumPoolSize(4);
        return new HikariDataSource(config);
    }
}
