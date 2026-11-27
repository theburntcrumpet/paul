package dev.paul.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AppSettingsTest extends IntegrationTest {

    @Autowired
    AppSettings settings;

    @Test
    void getOrCreateStoresOnceAndThenReturnsTheStoredValue() {
        String key = "test." + UUID.randomUUID();
        AtomicInteger calls = new AtomicInteger();

        assertThat(settings.get(key)).isEmpty();
        assertThat(settings.getOrCreate(key, () -> "v" + calls.incrementAndGet())).isEqualTo("v1");
        assertThat(settings.getOrCreate(key, () -> "v" + calls.incrementAndGet())).isEqualTo("v1");
        assertThat(settings.get(key)).contains("v1");
        assertThat(calls).hasValue(1);
    }

    @Test
    void rememberMeKeyIsGeneratedAndPersisted() {
        assertThat(settings.get("security.remember-me-key")).hasValueSatisfying(k -> assertThat(k).hasSize(64));
    }
}
