package dev.paul.user;

import dev.paul.config.SecurityProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * On first start (no users at all) creates {@code admin} with the configured initial password
 * ({@code paul.security.initial-admin-password}, env {@code PAUL_ADMIN_PASSWORD}, default
 * {@code admin}). The account must change its password before it can use anything else.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    static final String ADMIN_USERNAME = "admin";
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserService userService;
    private final SecurityProperties properties;

    public AdminBootstrap(UserService userService, SecurityProperties properties) {
        this.userService = userService;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userService.hasAnyUsers()) {
            return;
        }
        userService.createInitial(ADMIN_USERNAME, properties.initialAdminPassword());
        log.warn("Created initial user '{}' with the configured initial password. "
                + "Log in and choose a new password before exposing Paul to a network.", ADMIN_USERNAME);
    }
}
