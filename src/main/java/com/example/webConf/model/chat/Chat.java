package com.example.webConf.model.chat;

import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "chats")
public class Chat {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @ToString.Exclude
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE, CascadeType.REFRESH})
    @JoinTable(
            name = "users_chats",
            joinColumns = {@JoinColumn(name = "chat_id", referencedColumnName = "id")},
            inverseJoinColumns = {@JoinColumn(name = "user_id", referencedColumnName = "id")}
    )
    private List<UserEntity> participants = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private ChatType type = ChatType.SINGLE;

    public enum ChatType {
        SINGLE, // for one user (can be only one chat)
        PERSONAL, // for two users
        GROUP // for more than two users
    }

    public void addParticipant(UserEntity user) {
        if (!this.participants.contains(user)) {
            System.out.println("Adding participant " + user + " to chat " + this.id);
            this.participants.add(user);
            user.getChats().add(this);
        }
        // Setting chat type
        if(participants.size() == 1)
            this.type = ChatType.SINGLE;
        else if(participants.size() == 2)
            this.type = ChatType.PERSONAL;
        else if(participants.size() >= 3)
            this.type = ChatType.GROUP;
    }

    public void removeParticipant(UserEntity user) {
        if (this.participants.contains(user)) {
            this.participants.remove(user);
            user.getChats().remove(this);
        }
        // Setting chat type
        if(participants.size() == 1)
            this.type = ChatType.SINGLE;
        else if(participants.size() == 2)
            this.type = ChatType.PERSONAL;
        else if(participants.size() >= 3)
            this.type = ChatType.GROUP;
    }

    // Message
    @JsonIgnore
    @ToString.Exclude
    @OneToMany(mappedBy = "chat", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    // orphanRemoval child entities should be automatically deleted if they are no longer associated with the parent entity.
    private List<Message> messages = new ArrayList<>();

    public void addMessage(Message message) {
        if (!this.messages.contains(message)) {
            this.messages.add(message);
            message.setChat(this);
        }
    }

    // For Conference Chat
    @JsonIgnore
    @ToString.Exclude
    @OneToOne(mappedBy = "chat", fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    private Conference conference;

    // without this -> will be error in ChatController - deleteChat
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Chat)) return false;
        Chat chat = (Chat) o;
        return Objects.equals(getId(), chat.getId());
    }

    @Override
    public int hashCode() {
        return Objects.hash(getId());
    }

    // Files
    @ToString.Exclude
    @JsonIgnore
    @OneToMany(mappedBy = "chat", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Attachment> attachments = new ArrayList<>();

}

