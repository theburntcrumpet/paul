package dev.paul.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import dev.paul.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Regression test for {@code SQLITE_BUSY_SNAPSHOT}: a transaction that reads, lets another
 * connection write, then writes itself must succeed (it waits) rather than fail.
 */
class SqliteConcurrencyTest extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    @Test
    void readThenWriteTransactionSurvivesAConcurrentWrite() throws Exception {
        String key = "concurrency." + UUID.randomUUID();
        jdbc.update("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, '0')", key);
        CountDownLatch readDone = new CountDownLatch(1);

        CompletableFuture<Void> readThenWrite = CompletableFuture.runAsync(() -> tx.executeWithoutResult(status -> {
            jdbc.queryForObject("SELECT setting_value FROM app_settings WHERE setting_key = ?", String.class, key);
            readDone.countDown();
            sleep(300); // give the other writer every chance to get in between
            jdbc.update("UPDATE app_settings SET setting_value = 'first' WHERE setting_key = ?", key);
        }));

        assertThat(readDone.await(5, TimeUnit.SECONDS)).isTrue();
        CompletableFuture<Void> otherWrite = CompletableFuture.runAsync(() ->
                jdbc.update("UPDATE app_settings SET setting_value = 'second' WHERE setting_key = ?", key));

        CompletableFuture.allOf(readThenWrite, otherWrite).get(10, TimeUnit.SECONDS);

        // The other write waited for the first transaction to commit, so it landed last.
        assertThat(jdbc.queryForObject("SELECT setting_value FROM app_settings WHERE setting_key = ?", String.class, key))
                .isEqualTo("second");
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
