package com.example.webConf.Service;

import com.example.webConf.Dto.Registration.RegistrationDto;
import com.example.webConf.Model.User.UserEntity;

public interface UserEntityService {
  Boolean createUser(RegistrationDto user);
  UserEntity findByEmail(String email);

  void save(UserEntity userEntity);
}
