package com.example.webConf.repository;

import com.example.webConf.model.settings.SettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SettingsEntityRepository  extends JpaRepository<SettingsEntity, String> {
  Optional<SettingsEntity> findFirstByType(String type);
}
