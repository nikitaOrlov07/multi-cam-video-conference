package com.example.webConf.Repository;

import com.example.webConf.Model.User.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserEntityRepository extends JpaRepository<UserEntity,Long> {

    UserEntity findFirstBySurname(String surname);

    UserEntity findByEmail(String email);
    UserEntity findBySurname(String surname);
}
