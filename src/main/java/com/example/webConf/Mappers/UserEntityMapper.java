package com.example.webConf.mappers;

import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.user.UserEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserEntityMapper {
    private PasswordEncoder passwordEncoder;
    @Autowired
    public UserEntityMapper(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }
    public  UserEntity  registrationDtoToUserEntity(RegistrationDto registrationDto)
    {
       UserEntity userEntity = UserEntity.builder()
               .name(registrationDto.getName())
               .surname(registrationDto.getSurname())
               .password(passwordEncoder.encode(registrationDto.getPassword()))
               .email(registrationDto.getEmail())
               .city(registrationDto.getCity())
               .country(registrationDto.getCountry())
               .accountType(UserEntity.AccountType.PERMANENT)
               .build();
       return userEntity;
    }
}
