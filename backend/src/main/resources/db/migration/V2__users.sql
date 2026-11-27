CREATE TABLE users (
    id                   INTEGER      PRIMARY KEY AUTOINCREMENT,
    username             VARCHAR(64)  NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP    NOT NULL,
    updated_at           TIMESTAMP    NOT NULL
);

-- Schema required by Spring Security's JdbcTokenRepositoryImpl (persistent remember-me tokens).
CREATE TABLE persistent_logins (
    series    VARCHAR(64) PRIMARY KEY,
    username  VARCHAR(64) NOT NULL,
    token     VARCHAR(64) NOT NULL,
    last_used TIMESTAMP   NOT NULL
);

CREATE INDEX idx_persistent_logins_username ON persistent_logins (username);
