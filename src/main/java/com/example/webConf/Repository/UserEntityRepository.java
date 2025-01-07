package com.example.webConf.repository;

import com.example.webConf.model.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserEntityRepository extends JpaRepository<UserEntity, Long> {

    UserEntity findFirstByEmail(String email);

    UserEntity findByEmail(String email);

    Optional<UserEntity> findUserEntityByAccountTypeAndNameAndSurname(UserEntity.AccountType accountType,String name, String surname);

    Optional<UserEntity> findByNameAndSurname(String name, String surname);

}
