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
        return userService.findUserByUsername(userName).isPresent(); // need to implementt this in java script logic
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
    public ResponseEntity<?> controlPageSaveUser(@RequestBody RegistrationDto registrationDto) {
        log.info("Register user from \"Admin Control Page\" {}", registrationDto);

        /// Check existed by name and Surname
        if (userService.findUserByNameAndSurname(
                registrationDto.getName().toLowerCase(),
                registrationDto.getSurname().toLowerCase()
        ).isPresent()) {
            log.warn("User with this name:{} and surname:{} already exists", registrationDto.getName().toLowerCase(), registrationDto.getSurname().toLowerCase());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of("message", "User with this name and surname already exists")
            );
        }

        /// Check existed by email
        if (userService.findByEmail(registrationDto.getEmail()).isPresent()) {
            log.warn("User with this email: {} already exists", registrationDto.getEmail());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of("message", "User with this email already exists")
            );
        }
        System.out.println("Валидация прошла");

        if (userService.createUser(registrationDto)) {
            return ResponseEntity.ok(null);
        } else {
            throw new AuthException("Failed to register user");
        }
    }

    /// Delete user
    @PostMapping("/control/deleteUser/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            UserEntity user = userService.findById(id).orElseThrow(() -> new AuthException("User not found"));
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElse(null);

            RoleEntity adminRole = roleRepository.findByName("ADMIN");
            RoleEntity creatorRole = roleRepository.findByName("CREATOR");

            if (Objects.equals(user, currentUser)) {
                log.info("User with id: {} and roles: {} DELETE himself  at {}", user.getId(), user.getRoles(), LocalDateTime.now());
                userService.deleteUser(id);
                return ResponseEntity.ok(Map.of("status", "SELF_DELETE"));
            } else if (currentUser != null && (currentUser.getRoles().contains(adminRole) || currentUser.getRoles().contains(creatorRole))) {
                log.info("Admin with id: {} DELETE user {} with roles {} at {}", currentUser.getId(), id, user.getRoles(), LocalDateTime.now());
                userService.deleteUser(id);
                return ResponseEntity.ok(Map.of("status", "ADMIN_DELETE_USER"));
            } else {
                log.error("Illegal access while deleting user");
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Unauthorized deletion"));
            }
        } catch (RuntimeException e) {
            log.error("Error during user deletion", e);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /// Edit user information
    @PostMapping("/control/editUser/{id}")
    public ResponseEntity<?> editUser(@PathVariable Long id, @Valid @RequestBody RegistrationDto registrationDto) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("Illegal access"));
        UserEntity user = userService.findById(id).orElseThrow(() -> new AuthException("User not found"));

        RoleEntity adminRole = roleRepository.findByName("ADMIN");
        RoleEntity creatorRole = roleRepository.findByName("CREATOR");

        try {
            if (Objects.equals(user, currentUser)) {
                log.info("User with id: {} and roles: {} EDIT himself  at {}", user.getId(), user.getRoles(), LocalDateTime.now());
                userService.editUser(registrationDto);
            } else if (currentUser != null && (currentUser.getRoles().contains(adminRole) || currentUser.getRoles().contains(creatorRole))) {

            } else {

            }
        } catch (RuntimeException e) {
            log.error("Error during user deletion", e);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
        return null;
    }

}

