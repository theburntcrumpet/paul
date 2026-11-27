package dev.paul.auth;

import java.util.List;
import java.util.Locale;

import dev.paul.user.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class PaulUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public PaulUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        String normalised = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        return users.findByUsername(normalised)
                .map(u -> User.withUsername(u.getUsername())
                        .password(u.getPasswordHash())
                        .authorities(List.of(new SimpleGrantedAuthority("ROLE_USER")))
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("No such user"));
    }
}
