package com.example.webConf.Repository;

import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.User.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserEntityRepository extends JpaRepository<UserEntity, Long> {

    UserEntity findFirstByEmail(String email);

    UserEntity findByEmail(String email);
    Optional<UserEntity> findUserEntityByAccountTypeAndSurnameAndName(UserEntity.AccountType accountType , String surname , String name);

}
