package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.registration.RegistrationDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.RoleRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@Controller
@RequestMapping("/control")
@RequiredArgsConstructor
@Slf4j
public class ControlController { // Controller for admin control page
    private final UserEntityService userService;
    private final RoleRepository roleRepository;
    private final ConferenceService conferenceService;
    private RoleEntity adminRole;
    private RoleEntity creatorRole;

    @PostConstruct // will be called when constructor is created
    public void init() {
        this.adminRole = roleRepository.findByName("ADMIN").orElseThrow(() -> new AuthException("Role [ADMIN] not found"));
        this.creatorRole = roleRepository.findByName("CREATOR").orElseThrow(() -> new AuthException("Role [CREATOR] not found"));
    }

    @GetMapping()
    public String getAdminPage(Model model) {
        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));

        if (user.getRoles() == null || (!user.getRoles().contains(adminRole) && !user.getRoles().contains(creatorRole))) {
            throw new AuthException("You can not access this page");
        }

        ///  Finding all conferences
        List<Conference> conferences = conferenceService.findAllConferences();
        ///  Finding user conferences
        List<Conference> userConferences = conferenceService.findUserConferences(user);
        ///  Finding user Active Conferences
        List<Conference> activeConferences = conferenceService.findUserActiveConferences(user.getId());

        ///  Finding all users
        List<UserEntity> users = userService.findAllUsers();

        model.addAttribute("conferences", conferences);
        model.addAttribute("userConferences", userConferences);
        model.addAttribute("activeConferences", activeConferences);
        model.addAttribute("users", users);
        model.addAttribute("userName", user.getUserName());
        model.addAttribute("user", user);

        ///  Encoded information for userName
        String encodedUserName = Base64.getUrlEncoder().encodeToString(user.getUserName().getBytes());
        Map<String, String> conferenceMap = new HashMap<>();
        conferences.forEach(conference -> {
            conferenceMap.put(conference.getId(),Base64.getUrlEncoder().encodeToString(conference.getId().getBytes()));
        });
        model.addAttribute("encodedUserName", encodedUserName);
        model.addAttribute("conferenceMap", conferenceMap);

        return "control-page";
    }

    @PostMapping("/saveUser")
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

        if (userService.createUser(registrationDto)) {
            return ResponseEntity.ok(null);
        } else {
            throw new AuthException("Failed to register user");
        }
    }

    /// Delete user
    @PostMapping("/deleteUser/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            UserEntity user = userService.findById(id).orElseThrow(() -> new AuthException("User not found"));
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElse(null);

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
    @PostMapping("/editUser/{id}")
    public ResponseEntity<?> editUser(@PathVariable Long id, @Valid @RequestBody RegistrationDto registrationDto) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("Illegal access"));
        UserEntity user = userService.findById(id).orElseThrow(() -> new AuthException("User not found"));


        try {
            if (Objects.equals(user, currentUser)) {
                log.info("User with id: {} and roles: {} EDIT himself  at {}", user.getId(), user.getRoles(), LocalDateTime.now());
                userService.editUser(user.getId(), registrationDto);
                return ResponseEntity.ok(Map.of("status", "SELF_EDIT"));
            } else if (currentUser != null && (currentUser.getRoles().contains(adminRole) || currentUser.getRoles().contains(creatorRole))) {
                log.info("ADMIN with id: {} and roles: {} EDIT user with id: {}  at {}", currentUser.getId(), currentUser.getRoles(), user.getId(), LocalDateTime.now());
                userService.editUser(user.getId(), registrationDto);
                return ResponseEntity.ok(Map.of("status", "ADMIN_EDIT"));
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

    /// Setting Settings
    @GetMapping("/getSettings")
    @ResponseBody
    public List<SettingsEntity> getSettings() {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("Illegal access"));
        if (currentUser == null || (!currentUser.getRoles().contains(adminRole) && !currentUser.getRoles().contains(creatorRole))) {
            throw new AuthException("Illegal access");
        }
        return userService.getSettings();
    }

    @PostMapping("/setSettings")
    public ResponseEntity<?> editSettings(@RequestBody Map<String, String> settings) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("Illegal access"));
        if (!currentUser.getRoles().contains(adminRole) && !currentUser.getRoles().contains(creatorRole)) {
            throw new AuthException("Illegal access");
        }
        log.info("User with id {} edit settings {}", currentUser.getId(), settings);
        userService.editSettings(settings);
        return ResponseEntity.ok(null);
    }
}
