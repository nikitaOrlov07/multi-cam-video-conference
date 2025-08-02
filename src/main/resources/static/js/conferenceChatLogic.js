class ChatManager {
    constructor(conferenceId, userName, chatId) {
        this.conferenceId = conferenceId;
        this.userName = userName;
        this.stompClient = null;
        this.chatId = chatId;
        this.isFirstJoin = true;
        this.isConnected = false; // Добавляем флаг соединения
    }

    async init() {
        // Get the chatId from URL if available
        const pathParts = window.location.pathname.split('/');
        if (pathParts.includes('chat') && !isNaN(pathParts[pathParts.indexOf('chat') + 1])) {
            this.chatId = pathParts[pathParts.indexOf('chat') + 1];
        }

        await this.connectChat(); // Делаем асинхронным
        this.setupChatListeners();
    }

    connectChat() {
        return new Promise((resolve, reject) => {
            console.log("Connecting to WebSocket...");
            const socket = new SockJS('/ws');
            this.stompClient = Stomp.over(socket);

            this.stompClient.connect({}, (frame) => {
                console.log('Connected: ' + frame);
                console.log('StompClient ready:', this.stompClient);
                this.isConnected = true; // Устанавливаем флаг

                if (this.chatId) {
                    this.subscribeToChat(this.chatId);
                    this.addUser();
                } else if (this.conferenceId) {
                    // If we're in a conference, we'll get the chat ID later
                    this.subscribeToConferenceChat(this.conferenceId);
                }

                // Load any initial messages (if available in the page)
                if (typeof initialMessages !== 'undefined' && initialMessages) {
                    try {
                        const messages = JSON.parse(initialMessages);
                        if (Array.isArray(messages)) {
                            messages.forEach(msg => this.showMessage(msg));
                        }
                    } catch (e) {
                        console.error('Failed to parse initial messages:', e);
                    }
                }
                resolve(); // Разрешаем промис после успешного подключения
            }, (error) => {
                console.error('STOMP error:', error);
                this.isConnected = false;
                reject(error); // Отклоняем промис при ошибке
            });
        });
    }

    // Добавляем метод для подписки на конференцию
    subscribeToConferenceChat(conferenceId) {
        console.log("Subscribing to conference chat:", conferenceId);
        this.stompClient.subscribe('/topic/conference/' + conferenceId + '/chat', (response) => {
            console.log('Received conference chat message:', response.body);
            const message = JSON.parse(response.body);

            // Если получили chat ID от сервера
            if (message.chatId && !this.chatId) {
                this.chatId = message.chatId;
                console.log('Received chatId from server:', this.chatId);
                this.subscribeToChat(this.chatId);
                this.addUser();
            }
        });
    }

    // Subscribe to chat topic
    subscribeToChat(chatId) {
        if (!chatId) return;
        console.log("Subscribing to chat:", chatId);
        this.chatId = chatId;
        this.stompClient.subscribe('/topic/chat/' + chatId, (response) => {
            console.log('Received message:', response.body);
            const message = JSON.parse(response.body);
            console.log('Parsed message:', message);

            if (message === null) {
                console.log("User already in chat - no action needed");
                return;
            }

            if (message.type === 'JOIN') {
                console.log("Processing join message");
                this.showMessage(message);

                // If the message contains updated chat info, update our chatId
                if (message.chat && message.chat.id && message.chat.id !== this.chatId) {
                    const oldChatId = this.chatId;
                    this.chatId = message.chat.id;
                    console.log(`Changing chat ID from ${oldChatId} to ${this.chatId}`);

                    // Unsubscribe from old chat and subscribe to new one
                    this.stompClient.unsubscribe('/topic/chat/' + oldChatId);
                    this.subscribeToChat(this.chatId);

                    // Update URL without reloading the page
                    window.history.pushState({}, '', '/chat/' + this.chatId);
                }
            } else if (message.type === 'DELETE') {
                this.handleDeletedMessage(message);
            } else if (message.type === 'CHAT_DELETED') {
                this.handleChatDeleted();
            } else if (message.type === 'CLEAR') {
                this.handleChatCleared();
            } else {
                this.showMessage(message);
            }
        });
    }

    // Show message in chat
    showMessage(message) {
        if (!message.text && !message.content) {
            console.log('Received empty message:', message);
            return;
        }

        const chatContainer = document.querySelector('.projects-list');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }

        // Use appropriate text field based on message structure
        const messageText = message.text || message.content || '';
        const messageAuthor = message.author || (message.user ? message.user.username : 'Unknown');

        const messageDiv = document.createElement('div');
        messageDiv.dataset.messageId = message.id;

        if (message.type === 'JOIN') {
            messageDiv.className = 'join-message';
            messageDiv.textContent = messageText;
            messageDiv.style.textAlign = 'center';
            messageDiv.style.backgroundColor = '#e6f3ff';
            messageDiv.style.padding = '5px 10px';
            messageDiv.style.borderRadius = '10px';
            messageDiv.style.margin = '10px 0';
            messageDiv.style.fontStyle = 'italic';
            messageDiv.style.color = '#4a4a4a';
        }
        else {
            const messageContent = document.createElement('div');
            const authorParagraph = document.createElement('p');
            const textParagraph = document.createElement('p');
            const dateParagraph = document.createElement('p');

            authorParagraph.className = 'message-author';
            textParagraph.className = 'message-text';
            dateParagraph.className = 'message-time';

            // Check if the message is from the current user
            const isCurrentUser = messageAuthor === this.userName;

            if (isCurrentUser) {
                messageDiv.className = 'message message-right';
                authorParagraph.textContent = 'You:';

                // Add delete button for own messages
                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-primary btn-delete-message';
                deleteButton.textContent = 'Delete';
                deleteButton.style.width = 'auto';
                deleteButton.style.height = 'auto';
                deleteButton.style.position = 'absolute';
                deleteButton.style.right = '20px';
                deleteButton.style.top = '3px';
                deleteButton.type = 'button';
                deleteButton.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log("Delete button clicked for message:", message.id);
                    this.deleteMessage(message.id);
                };

                messageDiv.appendChild(deleteButton);
            } else {
                messageDiv.className = 'message message-left';
                authorParagraph.textContent = messageAuthor;
            }

            textParagraph.textContent = messageText;
            dateParagraph.textContent = message.pubDate || new Date().toLocaleString();

            messageContent.style = 'display: flex; flex-direction: column; flex-grow: 1;';
            messageContent.appendChild(authorParagraph);
            messageContent.appendChild(textParagraph);

            messageDiv.style.position = 'relative';
            messageDiv.appendChild(messageContent);
            messageDiv.appendChild(dateParagraph);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    handleDeletedMessage(message) {
        const messageElement = document.querySelector(`[data-message-id="${message.messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }

    addUser() {
        if (!this.chatId) {
            console.error("Cannot add user: chatId is undefined");
            return;
        }

        console.log("Adding user to chat:", this.userName, this.chatId);
        console.debug("Sending data for add User", JSON.stringify({
            author: this.userName,
            type: 'JOIN',
            chat: { id: this.chatId }
        }));

        this.stompClient.send(
            "/app/chat/" + this.chatId + "/addUser",
            {},
            JSON.stringify({
                author: this.userName,
                type: 'JOIN',
                chat: { id: this.chatId }
            })
        );
    }

    // Send message - улучшенная версия с проверками
    sendMessage() {
        console.log("Conference Chat Sending message");
        const messageInput = document.getElementById('commentText');

        if (!messageInput) {
            console.error("Message input element not found");
            return;
        }

        const messageContent = messageInput.value.trim();
        console.log("Attempting to send message: " + messageContent);

        // Проверяем все необходимые условия
        if (!messageContent) {
            console.error("Cannot send message: input is empty");
            return;
        }

        if (!this.stompClient) {
            console.error("Cannot send message: stompClient is not connected");
            return;
        }

        if (!this.isConnected) {
            console.error("Cannot send message: WebSocket is not connected");
            return;
        }

        if (!this.chatId) {
            console.error("Cannot send message: chatId is undefined");
            return;
        }

        console.log("All checks passed, sending message");
        const message = {
            author: this.userName,
            text: messageContent,
            type: 'CHAT',
        };

        try {
            this.stompClient.send("/app/chat/" + this.chatId + "/sendMessage", {}, JSON.stringify(message));
            messageInput.value = '';
            console.log("Message sent successfully");
        } catch (error) {
            console.error("Error sending message:", error);
        }

        this.updateCharCount();
    }

    // Delete message
    deleteMessage(messageId) {
        console.log("deleteMessage function called with messageId:", messageId);
        console.log("Current chatId:", this.chatId);
        if (this.stompClient && messageId && this.chatId) {
            console.log("Attempting to delete message. ChatId:", this.chatId, "MessageId:", messageId);
            this.stompClient.send("/app/chat/" + this.chatId + "/deleteMessage", {}, JSON.stringify({messageId: messageId}));
        } else {
            console.error("Cannot delete message: stompClient is not connected, messageId is undefined, or chatId is undefined");
            console.log("stompClient:", this.stompClient);
            console.log("messageId:", messageId);
            console.log("chatId:", this.chatId);
        }
    }

    // Handle chat deleted
    handleChatDeleted() {
        const chatContainer = document.querySelector('.projects-list');
        const deletedMessageDiv = document.createElement('div');
        deletedMessageDiv.className = 'chat-deleted-message';
        deletedMessageDiv.textContent = 'This chat has been deleted.';
        chatContainer.innerHTML = '';
        chatContainer.appendChild(deletedMessageDiv);

        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.style.display = 'none';
        }
    }

    // Handle chat cleared
    handleChatCleared() {
        const chatContainer = document.querySelector('.projects-list');
        chatContainer.innerHTML = '';

        const clearedMessageDiv = document.createElement('div');
        clearedMessageDiv.className = 'chat-cleared-message';
        clearedMessageDiv.textContent = 'Chat was cleared';
        chatContainer.appendChild(clearedMessageDiv);
    }

    // Update character count
    updateCharCount() {
        const textarea = document.getElementById('commentText');
        if (!textarea) return;

        const charCount = textarea.value.length;
        const charCountEl = document.getElementById('charCount');
        if (charCountEl) {
            charCountEl.textContent = charCount;
        }
    }

    setupChatListeners() {
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        } else {
            console.error("Message form not found");
        }

        const toggleChat = document.getElementById('toggleChat');
        if (toggleChat) {
            console.log("Found toggle chat button, attaching event listener");
            toggleChat.addEventListener('click', () => {
                console.log("Toggle chat button clicked");
                this.toggleChatModal();
            });
        } else {
            console.error("Toggle chat button not found");
        }

        const commentText = document.getElementById('commentText');
        if (commentText) {
            commentText.addEventListener('input', () => {
                this.updateCharCount();
            });
        } else {
            console.error("Comment text area not found");
        }
    }

    toggleChatModal() {
        const modal = document.getElementById('chatModal');
        if (modal) {
            console.log("Current display:", modal.style.display);
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
            console.log("New display:", modal.style.display);
        } else {
            console.error("Chat modal element not found");
        }
    }
}