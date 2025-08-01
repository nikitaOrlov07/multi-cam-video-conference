package com.example.webConf.dto.relationship;

import com.example.webConf.config.relationship.RelationshipStatus;
import lombok.Data;

@Data
public class UserRelationshipView {
    private Long id;
    private RelationshipStatus status;

    private Long requester_id;
    private String requester_name;

    private Long addresser_id;
    private String addresser_name;
}
