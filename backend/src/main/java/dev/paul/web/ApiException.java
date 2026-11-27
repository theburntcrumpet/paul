package dev.paul.web;

import org.springframework.http.HttpStatus;

/** An error to return to the client as {@code {"code": ..., "message": ...}} with the given status. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
