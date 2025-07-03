package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.relationship.RelationshipStatus;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.user.UserRelationship;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.repository.UserRelationshipRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.UserEntityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/invitation")
@RequiredArgsConstructor
public class FriendsLogicController {

    private final UserEntityService userEntityService;
    private final UserRelationshipRepository userRelationshipRepository;
    private final SettingsEntityRepository settingsEntityRepository;

    ///  Add invitation
    @PostMapping("/add/{secondUserId}")
    public ResponseEntity addInvitation(@PathVariable Long secondUserId) {

        UserEntity currentUser = userEntityService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        UserEntity secondUser = userEntityService.findById(secondUserId).orElseThrow(() -> new AuthException("User not found"));
        SettingsEntity intervalBetweenInvitation = settingsEntityRepository.findFirstByType("intervalBetweenFriendInvitation").orElse(null);
        LocalDateTime now = LocalDateTime.now();

        // Check if there was not same invitation before
        List<UserRelationship> userRelationShips = userRelationshipRepository.findUserRelationshipByRequester_IdAndAddressee_IdOrderByCreatedAtDesc(currentUser.getId(), secondUserId);

        if (!userRelationShips.isEmpty()) {
            if (userRelationShips.get(0).getStatus().equals(RelationshipStatus.BLOCKED))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

            if (userRelationShips.get(0).getStatus().equals(RelationshipStatus.ACCEPTED))
                return ResponseEntity.status(HttpStatus.OK).build();

            if (intervalBetweenInvitation != null && (userRelationShips.get(0).getStatus().equals(RelationshipStatus.PENDING))) {
                try {
                    long intervalMilliSeconds = Long.parseLong(intervalBetweenInvitation.getValue());
                    long actualMillis = ChronoUnit.MILLIS.between(userRelationShips.get(0).getCreatedAt(), now);
                    if (actualMillis > intervalMilliSeconds) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                    }
                } catch (NumberFormatException e) {
                    throw new RuntimeException(e);
                }
            }
        }

        UserRelationship userRelationship = UserRelationship.builder()
                .createdAt(now)
                .requester(currentUser)
                .addressee(secondUser)
                .status(RelationshipStatus.PENDING)
                .build();

        userRelationshipRepository.save(userRelationship);
        return ResponseEntity.ok(null);
    }

    /// Accept invitation
    @PostMapping("/accept/{invitationId}")
    public ResponseEntity acceptInvitation(@PathVariable Long invitationId) {
        return ResponseEntity.ok(null);
    }


    /// Decline invitation
    @PostMapping("/decline/{secondUserId}")
    public ResponseEntity declineInvitation(@PathVariable Long secondUserId) {
        return ResponseEntity.ok(null);
    }

    /// Block user
    @PostMapping("/block/{secondUserId}")
    public ResponseEntity blockUser(@PathVariable Long secondUserId) {
        return ResponseEntity.ok(null);
    }

    /// Unblock user
    @PostMapping("/unblock/{secondUserId}")
    public ResponseEntity unblockUser(@PathVariable Long secondUserId) {
        return ResponseEntity.ok(null);
    }

    /// Remove Friend
    @PostMapping("/remove/{secondUserId}")
    public ResponseEntity removeFriend(@PathVariable Long secondUserId) {
        return ResponseEntity.ok(null);
    }
}
