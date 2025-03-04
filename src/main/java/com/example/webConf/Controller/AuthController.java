package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.RoleRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
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
    private final ConferenceService conferenceService;
    private final RoleRepository roleRepository;

    @GetMapping("/register")
    public String getRegisterForm(Model model) {
        RegistrationDto user = new RegistrationDto();
        model.addAttribute("user", user); // we add empty object into a View ,
        // but if we don`t do it --> we will get an error
        return "register";
    }

    @PostMapping("/register/save")
    public String register(@Valid @ModelAttribute RegistrationDto registrationDto,
                           BindingResult result, Model model) {
        if (result.hasErrors()) {
            // Add user object to model to preserve form data
            model.addAttribute("user", registrationDto);
            return "register";
        }
        log.info("Register user: {}", registrationDto);

        /// Check by name and Surname
        userService.findUserByNameAndSurname(registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase()).ifPresent(user -> {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            throw new AuthException("User with this name and surname already exists");
        });

        /// Check by email
        userService.findByEmail(registrationDto.getEmail()).ifPresent(user -> {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            throw new AuthException("User with this email is already registered");
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
        return userService.findUserByUsername(userName).isPresent();
    }

    @Scheduled(fixedRate = 60 * 60 * 1000) // every hour
    public void deleteTemporaryUnusedAccounts() {
        userService.deleteUnusedTemporaryAccounts();
    }

    ///  Admin / Creator  Control Page
    @GetMapping("/control")
    public String getAdminPage(Model model) {
        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        if (user.getRoles() == null || !user.getRoles().contains(roleRepository.findByName("ADMIN"))) {
            throw new AuthException("You can not access this page");
        }

        ///  Finding all conferences
        List<Conference> conferences = conferenceService.findAllConferences();

        ///  Finding all users
        List<UserEntity> users = userService.findAllUsers();

        model.addAttribute("conferences", conferences);
        model.addAttribute("users", users);

        return "control-page";
    }

    @PostMapping("/control/saveUser")
    public ResponseEntity<?> controlPageSaveUser(@Valid @RequestBody RegistrationDto registrationDto,
                                                 BindingResult result) {
        log.info("Register user from \"Admin Control Page\" {}", registrationDto);

        /// Check existed by name and Surname
        if (userService.findUserByNameAndSurname(
                registrationDto.getName().toLowerCase(),
                registrationDto.getSurname().toLowerCase()
        ).isPresent()) {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            return ResponseEntity.status(HttpStatus.CONFLICT).body("User with this name and surname already exists");
        }

        /// Check existed by email
        if (userService.findByEmail(registrationDto.getEmail()).isPresent()) {
            log.warn("User with this email: {} already exists", registrationDto.getEmail());
            return ResponseEntity.status(HttpStatus.CONFLICT).body("User with this email already exists");
        }

        if (result.hasErrors()) {
            log.warn("Validation Error");
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Validation Error");
        }

        if (userService.createUser(registrationDto)) {
            return ResponseEntity.ok(null);
        } else {
            throw new AuthException("Failed to register user");
        }
    }

    @PostMapping("/control/deleteUser/{uuid}")
    public ResponseEntity<?> deleteUser(@PathVariable Long uuid) {
        RoleEntity adminRole = roleRepository.findByName("ADMIN");
        RoleEntity creatorRole = roleRepository.findByName("CREATOR");
        try {
            UserEntity user = userService.findById(uuid).orElseThrow(() -> new AuthException("User not found"));
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElse(null);
            if (Objects.equals(user, currentUser)) {
                log.info("User with id: {} and roles: {} delete himself  at {}", user.getId(),user.getRoles(), LocalDateTime.now());
                userService.deleteUser(uuid);
                return ResponseEntity.ok("User delete himself");
            } else if (currentUser != null && user.getRoles().contains(adminRole) || user.getRoles().contains(creatorRole)) {
                 log.info("Admin with id: {} delete user {} with roles {} at {}", currentUser.getId() , uuid , user.getRoles() , LocalDateTime.now());
                 userService.deleteUser(uuid);
                 return ResponseEntity.ok("Admin delete user");
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }
}

