package com.example.webConf.model.chat;

import com.example.webConf.config.message.MessageType;
import com.example.webConf.dto.AttachmentUploadResponse;
import com.example.webConf.model.user.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Builder
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String text;
    private String author;
    private String pubDate;

    @Enumerated(EnumType.STRING)
    private MessageType type;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "chat_id")
    @ToString.Exclude
    private Chat chat;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id")
    @ToString.Exclude
    @JsonIgnore
    private UserEntity user;

    public Message(String text) {
        this.text = text;
    }

    private Long fileId;
    private String fileName;
    private String viewUrl;
    private String downloadUrl;
}
