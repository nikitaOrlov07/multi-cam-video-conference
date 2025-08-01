package com.example.webConf.repository;

import com.example.webConf.config.relationship.RelationshipStatus;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.user.UserRelationship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserRelationshipRepository extends JpaRepository<UserRelationship, Long> {
    List<UserRelationship> findUserRelationshipByRequester_IdAndAddressee_IdOrderByCreatedAtDesc(Long requester_Id, Long addressee_Id);

    List<UserRelationship> findUserRelationshipByRequester(UserEntity user);

    ///  Find users
    @Query("SELECT ur.requester FROM UserRelationship ur WHERE ur.addressee = :user AND ur.status = :status")
    List<UserEntity> findRequstersByAddresseeAndStatus(@Param("user") UserEntity user , @Param("status") RelationshipStatus status);

    @Query("SELECT ur.addressee FROM UserRelationship ur WHERE ur.requester= :user AND ur.status = :status")
    List<UserEntity> findAddresersByRequesterAndStatus(@Param("user") UserEntity user ,@Param("status") RelationshipStatus status);

    /// Find invitations
    @Query("SELECT ur FROM UserRelationship ur WHERE ur.addressee= :user and ur.status = :status order by ur.createdAt desc")
    List<UserRelationship> findInvitationToUser(@Param("user") UserEntity user , @Param("status") RelationshipStatus status);
}
