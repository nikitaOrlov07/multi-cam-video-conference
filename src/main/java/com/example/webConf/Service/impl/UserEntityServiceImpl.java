package com.example.webConf.Service.impl;

import com.example.webConf.Dto.Registration.RegistrationDto;
import com.example.webConf.Mappers.UserEntityMapper;
import com.example.webConf.Model.User.UserEntity;
import com.example.webConf.Repository.UserEntityRepository;
import com.example.webConf.Service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Slf4j
public class UserEntityServiceImpl implements UserEntityService{
    private UserEntityRepository userEntityRepository;
    private UserEntityMapper userEntityMapper;

    @Autowired
    public UserEntityServiceImpl(UserEntityRepository userEntityRepository,
                                 UserEntityMapper userEntityMapper) {
        this.userEntityRepository = userEntityRepository;
        this.userEntityMapper = userEntityMapper;
    }

    @Override
    public Boolean createUser(RegistrationDto user) {
        log.info("Saving user service method is called");
        log.info("Name: " + user.getName());
        UserEntity savedUser = userEntityRepository.save(userEntityMapper.registrationDtoToUserEntity(user));
        return savedUser != null;
    }

    @Override
    public UserEntity findByEmail(String email) {
        if(email == null || email.isEmpty())
            return null;
        return  userEntityRepository.findByEmail(email);
    }



    @Override
    public void save(UserEntity userEntity) {
        log.info("Saving user");
        userEntityRepository.save(userEntity);
    }
}
