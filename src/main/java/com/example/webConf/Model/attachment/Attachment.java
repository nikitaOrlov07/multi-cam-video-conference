package com.example.webConf.model.attachment;

import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String fileName;
    private String fileType;
    private String downloadUrl;
    private String viewUrl;
    private LocalDateTime timestamp;


    // that a class property must be mapped to a larger object in the database.
    @Lob
    @Column(columnDefinition = "oid")
    private byte[] data;

    public Attachment(String fileName, String fileType, byte[] data, String downloadUrl ,String viewUrl) {
        this.fileName = fileName;
        this.fileType = fileType;
        this.data = data;
        this.downloadUrl=downloadUrl;
        this.viewUrl= viewUrl;
    }

    @ToString.Exclude
    @JsonBackReference // to eliminate recursion
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", referencedColumnName = "id")
    private Chat chat;

    @ManyToOne
    @JoinColumn(name = "user_id")
    @JsonBackReference
    private UserEntity user;

}
