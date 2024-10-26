package com.example.webConf.Mappers;

import com.example.webConf.Dto.RegistrationDto;
import com.example.webConf.Model.UserEntity;
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
               .build();
       return userEntity;
    }
}
