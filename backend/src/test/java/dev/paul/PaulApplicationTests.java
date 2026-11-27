package dev.paul;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;

import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class PaulApplicationTests extends IntegrationTest {

    @Autowired
    DataSource dataSource;

    @Test
    void createsSqliteDatabaseInDataDirAndRunsMigrations() {
        assertThat(dataDir.resolve("paul.db")).exists();

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Integer tables = jdbc.queryForObject(
                "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'", Integer.class);
        assertThat(tables).isEqualTo(1);
    }

    @Test
    void enablesWalModeAndForeignKeys() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("PRAGMA journal_mode", String.class)).isEqualToIgnoringCase("wal");
        assertThat(jdbc.queryForObject("PRAGMA foreign_keys", Integer.class)).isEqualTo(1);
    }
}
