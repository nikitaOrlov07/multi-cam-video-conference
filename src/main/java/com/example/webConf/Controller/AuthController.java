package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.RegistrationException;
import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.RoleRepository;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
//import com.example.webConf.service.impl.RecaptchaService;
import com.example.webConf.service.impl.RecaptchaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@Controller
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserEntityService userService;
    private final RecaptchaService recaptchaService;

    @GetMapping("/register")
    public String getRegisterForm(Model model) {
        RegistrationDto user = new RegistrationDto();
        model.addAttribute("user", user);
        return "register";
    }

    @PostMapping("/register/save")
    public String register(@Valid @ModelAttribute RegistrationDto registrationDto,
                           @RequestParam("recaptcha-token") String recaptchaToken,
                           BindingResult result, Model model) {

        if (!recaptchaService.verify(recaptchaToken)) {
           throw new RegistrationException("Recaptcha verification failed");
        }
        if (result.hasErrors()) {
            model.addAttribute("user", registrationDto);
            return "register";
        }
        log.info("Register user: {}", registrationDto);

        /// Check by name and Surname
        userService.findUserByNameAndSurname(registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase()).ifPresent(user -> {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            throw new RegistrationException("User with this name and surname already exists");
        });

        ///  Check by userName
        userService.findUserByUsername(registrationDto.getName() + " " + registrationDto.getSurname()).ifPresent(user -> {
            log.warn("User with this userName already exists: {}",registrationDto.getName() + " " + registrationDto.getSurname());
            throw new RegistrationException("User with this userName already exists");
        });

        /// Check by email
        userService.findByEmail(registrationDto.getEmail()).ifPresent(user -> {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            throw new RegistrationException("User with this email is already registered");
        });

        if (result.hasErrors()) {
            // Add user object to model to preserve form data
            model.addAttribute("user", registrationDto);
            return "register";
        }

        if (userService.createUser(registrationDto)) {
            return "redirect:/home?successfullyRegistered";
        } else {
            throw new AuthException("Failed to register user");
        }
    }

    @GetMapping("/isAccountExisting/{userName}")
    public boolean checkAccountExistence(@PathVariable String userName) {
        return userService.findUserByUsername(userName).isPresent(); //TODO =>  need to implement this in java script logic
    }

}

