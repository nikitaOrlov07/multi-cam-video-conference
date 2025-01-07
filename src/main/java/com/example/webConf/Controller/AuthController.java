package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.service.UserEntityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@RequiredArgsConstructor
public class AuthController {

    private final UserEntityService userService;

    @GetMapping("/register")
    public String getRegisterForm(Model model) {
        RegistrationDto user = new RegistrationDto();
        model.addAttribute("user", user); // we add empty object into a View ,
        // but if we don`t do it --> we will get an error
        return "register";
    }

    @PostMapping("/register/save")
    public String register(@Valid @ModelAttribute("user") RegistrationDto user,
                           BindingResult result, Model model) {
        // Check by email
        UserEntity existingUserEmail = userService.findByEmail(user.getEmail());

        if (existingUserEmail != null && existingUserEmail.getEmail() != null && !existingUserEmail.getEmail().isEmpty()) {
            model.addAttribute("user", user);
            throw new AuthException("User with this email is already registered");
        }


        if (result.hasErrors()) {
            // Add user object to model to preserve form data
            model.addAttribute("user", user);
            return "register";
        }

        if (userService.createUser(user)) {
            return "redirect:/home?successfullyRegistered";
        } else {
            throw new AuthException("Failed to register user");
        }
    }
}

