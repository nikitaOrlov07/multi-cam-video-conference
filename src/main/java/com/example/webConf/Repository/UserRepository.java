package com.example.webConf.Repository;

import com.example.webConf.Model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity,Long> {

    UserEntity findFirstByUsername(String username);
}
