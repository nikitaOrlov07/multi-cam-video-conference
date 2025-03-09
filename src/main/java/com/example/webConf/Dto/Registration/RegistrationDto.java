package com.example.webConf.dto.Registration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RegistrationDto {

    @NotBlank(message = "You need to provide your name")
    @NotNull(message = "You need to provide your name")
    @NotEmpty(message = "You need to provide your name")
    private String name;

    @NotBlank(message = "You need to provide your surname")
    @NotNull(message = "You need to provide your surname")
    @NotEmpty(message = "You need to provide your surname")
    private String surname;

    @NotBlank(message = "You need to provide your password")
    @NotNull(message = "You need to provide your password")
    @NotEmpty(message = "You need to provide your password")
    private String password;

    @NotBlank(message = "You need to provide your email address")
    @NotNull(message = "You need to provide your email address")
    @NotEmpty(message = "You need to provide your email address")
    private String email;
    private String city;
    private String country;
    private String address;
    private String role;
}

