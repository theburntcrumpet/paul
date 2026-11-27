package dev.paul.web;

import java.io.IOException;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built single-page app from {@code classpath:/static/}.
 *
 * <p>Existing files are served as-is. Client-side routes such as {@code /books/42/edit} (no file
 * extension in the last segment) fall back to {@code index.html} so deep links and refreshes
 * work. Missing assets ({@code /assets/x.js}) and anything under {@code /api} or
 * {@code /actuator} are never rewritten, so they 404 normally.
 */
@Configuration(proxyBeanMethods = false)
public class SpaResourceConfig implements WebMvcConfigurer {

    private static final String STATIC = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC)
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    static final class SpaFallbackResolver extends PathResourceResolver {

        private final Resource index = new ClassPathResource("static/index.html");

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (!resourcePath.isEmpty() && requested.exists() && requested.isReadable()) {
                return requested;
            }
            return isClientRoute(resourcePath) && index.exists() ? index : null;
        }

        static boolean isClientRoute(String path) {
            if (path.equals("api") || path.startsWith("api/")
                    || path.equals("actuator") || path.startsWith("actuator/")) {
                return false;
            }
            String last = path.substring(path.lastIndexOf('/') + 1);
            return !last.contains(".");
        }
    }
}
