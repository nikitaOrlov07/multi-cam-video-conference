package com.example.webConf.dto.Registration;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RegistrationDto {
    @NotEmpty(message = "You need to provide your name")
    private String name;
    @NotEmpty(message = "You need to provide your surname")
    private String surname;
    @NotEmpty(message = "You need to provide your password")
    private String password;
    @NotEmpty(message = "You need to provide your email address")
    private String email;
    private String city;
    private String country;
}
