package dev.paul.config;

import java.security.SecureRandom;
import java.util.HexFormat;

import javax.sql.DataSource;

import dev.paul.auth.JsonAuthResponses;
import dev.paul.auth.PasswordChangeRequiredFilter;
import dev.paul.user.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;

/**
 * Security for a same-origin SPA:
 *
 * <ul>
 *   <li>JSON login at {@code POST /api/auth/login} (see {@code AuthController}), server-side session
 *   <li>persistent remember-me tokens, always issued at login, so devices stay signed in
 *   <li>cookie-to-header CSRF protection ({@code XSRF-TOKEN} cookie, {@code X-XSRF-TOKEN} header)
 *   <li>users with an initial or reset password can only change it until they do
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    public static final String REMEMBER_ME_COOKIE = "paul-remember-me";
    private static final String REMEMBER_ME_KEY_SETTING = "security.remember-me-key";

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            PersistentTokenBasedRememberMeServices rememberMeServices,
            UserRepository users) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers("/api/**", "/actuator/**").authenticated()
                        .anyRequest().permitAll())
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .rememberMe(rm -> rm.rememberMeServices(rememberMeServices))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler())
                        .deleteCookies("JSESSIONID"))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(JsonAuthResponses::unauthorized)
                        .accessDeniedHandler(JsonAuthResponses::forbidden))
                .addFilterAfter(new PasswordChangeRequiredFilter(users), AuthorizationFilter.class)
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable());
        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public PersistentTokenRepository persistentTokenRepository(DataSource dataSource) {
        JdbcTokenRepositoryImpl repository = new JdbcTokenRepositoryImpl();
        repository.setDataSource(dataSource);
        return repository;
    }

    @Bean
    public PersistentTokenBasedRememberMeServices rememberMeServices(
            AppSettings settings,
            UserDetailsService userDetailsService,
            PersistentTokenRepository tokenRepository,
            SecurityProperties properties) {
        String key = settings.getOrCreate(REMEMBER_ME_KEY_SETTING, SecurityConfig::randomKey);
        PersistentTokenBasedRememberMeServices services =
                new PersistentTokenBasedRememberMeServices(key, userDetailsService, tokenRepository);
        services.setCookieName(REMEMBER_ME_COOKIE);
        services.setAlwaysRemember(true);
        services.setTokenValiditySeconds((int) properties.rememberMeValidity().toSeconds());
        return services;
    }

    private static String randomKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
