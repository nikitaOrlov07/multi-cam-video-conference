package com.example.webConf.repository;

import com.example.webConf.model.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface UserEntityRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findFirstByEmail(String email);

    Optional<UserEntity> findFirstByAccountTypeAndNameAndSurname(UserEntity.AccountType accountType, String name, String surname);

    Optional<UserEntity> findFirstByNameAndSurname(String name, String surname);

    @Query(value = "SELECT * FROM users u WHERE u.account_type = CAST(:accountType AS VARCHAR) AND ABS(EXTRACT(EPOCH FROM (:currentTime - u.created_at))/60) > 60", nativeQuery = true)
    Set<UserEntity> findAllByAccountTypeAndCreatedAtOlderThan60Minutes(
            @Param("accountType") String accountType,
            @Param("currentTime") LocalDateTime currentTime);

    ///  Searching users by search query
    @Query("SELECT u FROM UserEntity u WHERE u.name LIKE %:query% OR u.surname LIKE %:query%")
    List<UserEntity> searchByNameOrSurname(@Param("query") String query);

    Optional<UserEntity> findFirstByUserName(String username);
}