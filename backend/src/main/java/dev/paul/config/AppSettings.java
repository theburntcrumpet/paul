package dev.paul.config;

import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Small key/value store (table {@code app_settings}) for application-level state. */
@Component
public class AppSettings {

    private final JdbcTemplate jdbc;

    public AppSettings(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> get(String key) {
        List<String> values = jdbc.queryForList(
                "SELECT setting_value FROM app_settings WHERE setting_key = ?", String.class, key);
        return values.stream().findFirst();
    }

    /** Returns the stored value, storing {@code initial} first if the key is absent. */
    @Transactional
    public String getOrCreate(String key, Supplier<String> initial) {
        return get(key).orElseGet(() -> {
            jdbc.update("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) "
                    + "ON CONFLICT (setting_key) DO NOTHING", key, initial.get());
            return get(key).orElseThrow();
        });
    }
}
