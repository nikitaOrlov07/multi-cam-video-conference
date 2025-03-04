package com.example.webConf.repository;

import com.example.webConf.model.role.RoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<RoleEntity,Long> {
   RoleEntity findByName(String name);
}
