package com.example.webConf.Service;

import com.example.webConf.Dto.RegistrationDto;
import com.example.webConf.Model.UserEntity;

public interface UserEntityService {
  Boolean saveUser(RegistrationDto user);
  UserEntity findByEmail(String email);
}
