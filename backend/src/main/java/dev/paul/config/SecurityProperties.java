package dev.paul.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Security settings, bound from {@code paul.security.*}.
 *
 * @param initialAdminPassword password for the {@code admin} user created on first start
 * @param rememberMeValidity how long a "remember me" login lasts without being used
 */
@ConfigurationProperties("paul.security")
public record SecurityProperties(
        @DefaultValue("admin") String initialAdminPassword,
        @DefaultValue("90d") Duration rememberMeValidity) {}
