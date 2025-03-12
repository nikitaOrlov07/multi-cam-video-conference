package com.example.webConf.mappers;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.RoleRepository;
import com.example.webConf.repository.UserEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserEntityMapper {
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;

    public  UserEntity  registrationDtoToUserEntity(RegistrationDto registrationDto)
    {
       RoleEntity userRole = roleRepository.findByName("USER").orElseThrow(() -> new AuthException("User Role Not Found"));
       UserEntity userEntity = UserEntity.builder()
               .name(registrationDto.getName().toLowerCase())
               .surname(registrationDto.getSurname().toLowerCase())
               .password(passwordEncoder.encode(registrationDto.getPassword()))
               .email(registrationDto.getEmail())
               .city(registrationDto.getCity())
               .country(registrationDto.getCountry())
               .roles(List.of(userRole))
               .accountType(UserEntity.AccountType.PERMANENT)
               .build();
       return userEntity;
    }
}
