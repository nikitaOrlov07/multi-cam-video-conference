package com.example.webConf.config.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ConferenceException.class)
    public String handleConferenceException(ConferenceException ex, RedirectAttributes redirectAttributes) {
        redirectAttributes.addFlashAttribute("errorMessage", ex.getMessage());
        log.error("Conference exception: {}" ,ex.getMessage());
        return "redirect:/home?error";
    }
    @ExceptionHandler(AuthException.class)
    public String handleAuthException(AuthException ex, RedirectAttributes redirectAttributes) {
        redirectAttributes.addFlashAttribute("errorMessage", ex.getMessage());
        log.error("Auth Exception: {}",ex.getMessage());
        return "redirect:/home?error";
    }
    @ExceptionHandler(ChatException.class)
    public String handleChatException(ChatException ex, RedirectAttributes redirectAttributes) {
        redirectAttributes.addFlashAttribute("errorMessage", ex.getMessage());
        log.error("Chat Exception: {}" , ex.getMessage());
        return "redirect:/home?error";
    }
}
