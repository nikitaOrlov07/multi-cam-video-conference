package com.example.webConf.dto.message;

import com.example.webConf.config.message.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageView {
    private Long id;
    private String text;
    private String author;
    private String pubDate;
    private MessageType type;
    private boolean invitation;
}
