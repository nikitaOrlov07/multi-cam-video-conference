package com.example.webConf.repository;

import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.user.UserRelationship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRelationshipRepository extends JpaRepository<UserRelationship , Long> {

    List<UserRelationship> findUserRelationshipByRequester_IdAndAddressee_IdOrderByCreatedAtDesc(Long requester_Id, Long addressee_Id);
}
