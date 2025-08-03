package com.example.webConf.mappers;

import com.example.webConf.dto.message.MessageView;
import com.example.webConf.model.chat.Message;
import org.springframework.beans.BeanUtils;

public class MessageMapper {

    public static Message getMessageFromMessageView(MessageView messageView) {
        Message message = new Message();
        BeanUtils.copyProperties(messageView, message);
        return message;
    }

    public static MessageView getMessageViewFromMessage(Message message) {
        MessageView messageView = new MessageView();
        BeanUtils.copyProperties(message, messageView);
        return messageView;
    }
}
