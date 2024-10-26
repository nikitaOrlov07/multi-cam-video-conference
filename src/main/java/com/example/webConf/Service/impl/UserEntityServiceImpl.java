package com.example.webConf.Service.impl;

import com.example.webConf.Dto.RegistrationDto;
import com.example.webConf.Mappers.UserEntityMapper;
import com.example.webConf.Model.UserEntity;
import com.example.webConf.Repository.UserEntityRepository;
import com.example.webConf.Service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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
    public Boolean saveUser(RegistrationDto user) {
        log.info("Saving user service method is called");
        UserEntity savedUser = userEntityRepository.save(userEntityMapper.registrationDtoToUserEntity(user));
        return savedUser != null;
    }

    @Override
    public UserEntity findByEmail(String email) {
        return  userEntityRepository.findByEmail(email);
    }
}
