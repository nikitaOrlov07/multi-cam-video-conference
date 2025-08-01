package com.example.webConf.mappers;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.registration.RegistrationDto;
import com.example.webConf.dto.relationship.UserRelationshipView;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.user.UserRelationship;
import com.example.webConf.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserEntityMapper {
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;

    public UserEntity registrationDtoToUserEntity(RegistrationDto registrationDto) {
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

    public UserRelationshipView userRelationshipToView(UserRelationship userRelationship) {
        UserRelationshipView userRelationshipView = new UserRelationshipView();
        userRelationshipView.setId(userRelationship.getId());
        userRelationshipView.setStatus(userRelationship.getStatus());

        userRelationshipView.setRequester_id(userRelationship.getRequester().getId());
        userRelationshipView.setRequester_name(userRelationship.getRequester().getName());

        userRelationshipView.setAddresser_id(userRelationship.getAddressee().getId());
        userRelationshipView.setAddresser_name(userRelationship.getAddressee().getName());

        return userRelationshipView;
    }
}
