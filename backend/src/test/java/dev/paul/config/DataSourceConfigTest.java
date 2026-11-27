package dev.paul.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DataSourceConfigTest {

    @TempDir
    Path tmp;

    @Test
    void createsMissingDataDirectory() {
        Path nested = tmp.resolve("a/b/c");
        try (HikariDataSource ds = (HikariDataSource) new DataSourceConfig().dataSource(new PaulProperties(nested))) {
            assertThat(nested).isDirectory();
            assertThat(ds.getJdbcUrl()).startsWith("jdbc:sqlite:").contains("paul.db");
        }
    }

    @Test
    void failsClearlyWhenDataDirIsAFile() throws Exception {
        Path file = Files.createFile(tmp.resolve("not-a-dir"));
        assertThatThrownBy(() -> new DataSourceConfig().dataSource(new PaulProperties(file)))
                .isInstanceOf(UncheckedIOException.class)
                .hasMessageContaining("Cannot create data directory");
    }
}
