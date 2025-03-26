class ChatManager {
    constructor(conferenceId, userName) {
        this.conferenceId = conferenceId;
        this.userName = userName;
        this.stompClient = null;
        this.chatId = null;
        this.isFirstJoin = true;
    }
    init() {
        this.connectChat();
        this.setupChatListeners();
    }

    connectChat() {
        const socket = new SockJS('/ws');
        this.stompClient = Stomp.over(socket);
        this.stompClient.connect({}, (frame) => {
            this.subscribeToChat();
            this.addUser();
        });
    }
    connectChat() {
        console.log("Connecting to WebSocket...");
        const socket = new SockJS('/ws');
        this.stompClient = Stomp.over(socket);
        this.stompClient.connect({}, (frame) => {
            console.log('Connected: ' + frame);
            console.log('StompClient ready:', this.stompClient);
            this.subscribeToChat(this.chatId);
            this.addUser();

            if (this.isFirstJoin) {
                this.sendJoinMessage();
                localStorage.setItem(`hasJoined_${this.chatId}`, 'true');
            }

            if (typeof initialMessages !== 'undefined') {
                JSON.parse(initialMessages).forEach(msg => this.showMessage(msg));
            }
        }, (error) => {
            console.error('STOMP error:', error);
        });
    }

    // Subscribe to chat topic
    subscribeToChat(chatId) {
        console.log("Subscribing to chat:", chatId);
        this.stompClient.subscribe('/topic/chat/' + chatId, (response) => {
            console.log('Received message:', response.body);
            const message = JSON.parse(response.body);
            console.log('Parsed message:', message);
            if (message.type === 'JOIN') {
                console.log("Processing join message");
                this.showMessage(message);
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

    // Handle deleted message
    handleDeletedMessage(message) {
        console.log("Handling deleted message:", message);
        const messageId = message.text;
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        } else {
            console.error("Could not find message element to delete");
        }
    }

    // Send join message
    sendJoinMessage() {
        if (this.stompClient && this.stompClient.connected) {
            const joinMessage = {
                author: this.username,
                text: `${this.username} has entered the chat`,
                type: 'JOIN'
            };
            this.stompClient.send("/app/chat/" + this.chatId + "/sendMessage", {}, JSON.stringify(joinMessage));
        } else {
            console.error("Cannot send join message: stompClient is not connected");
        }
    }

    // Show message in chat
    showMessage(message) {
        if (!message.text || message.text.trim() === '') {
            console.log('Received empty message:', message);
            return;
        }

        const chatContainer = document.querySelector('.projects-list');
        const currentUsername = this.username;

        const messageDiv = document.createElement('div');
        messageDiv.dataset.messageId = message.id;

        if (message.type === 'JOIN') {
            messageDiv.className = 'join-message';
            messageDiv.textContent = message.text;
            messageDiv.style.textAlign = 'center';
            messageDiv.style.backgroundColor = '#e6f3ff';
            messageDiv.style.padding = '5px 10px';
            messageDiv.style.borderRadius = '10px';
            messageDiv.style.margin = '10px 0';
            messageDiv.style.fontStyle = 'italic';
            messageDiv.style.color = '#4a4a4a';
        } else {
            const messageContent = document.createElement('div');
            const authorParagraph = document.createElement('p');
            const textParagraph = document.createElement('p');
            const dateParagraph = document.createElement('p');

            authorParagraph.className = 'message-author';
            textParagraph.className = 'message-text';
            dateParagraph.className = 'message-text';

            if (message.author === currentUsername) {
                messageDiv.className = 'message message-right';
                authorParagraph.textContent = 'You:';

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-primary';
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
                authorParagraph.textContent = message.author;
            }

            textParagraph.textContent = message.text;
            dateParagraph.textContent = message.pubDate || new Date().toLocaleString();

            messageContent.style = 'display: flex; justify-content: space-between; flex-grow: 1;';
            messageContent.appendChild(authorParagraph);
            messageContent.appendChild(textParagraph);

            messageDiv.style.position = 'relative';
            messageDiv.appendChild(messageContent);
            messageDiv.appendChild(dateParagraph);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Add user to chat
    addUser() {
        console.log("Adding user to chat:", this.username, this.chatId);
        this.stompClient.send("/app/chat/" + this.chatId + "/addUser",
            {},
            JSON.stringify({author: this.username, type: 'JOIN', chat: {id: this.chatId}}),
            (response) => {
                console.log("Server response to addUser:", response);
                if (response.body) {
                    let message = JSON.parse(response.body);
                    console.log("Parsed server response:", message);
                    if (message) {
                        console.log('User added to chat or chat created');
                        if (message.chat && message.chat.id !== this.chatId) {
                            this.chatId = message.chat.id;
                            this.stompClient.unsubscribe('/topic/chat/' + this.chatId);
                            this.subscribeToChat(this.chatId);
                            console.log("User added to new chat:", this.chatId);
                            window.history.pushState({}, '', '/chat/' + this.chatId);
                            this.isFirstJoin = true;
                        }
                    } else {
                        console.log('User already in chat');
                        this.isFirstJoin = false;
                    }
                }
            }
        );
    }

    // Send message
    sendMessage() {
        const messageInput = document.getElementById('commentText');
        const messageContent = messageInput.value.trim();
        console.log("Sent message: " + messageContent);
        if (messageContent && this.stompClient) {
            const message = {
                author: this.username,
                text: messageContent,
                type: 'CHAT',
            };
            this.stompClient.send("/app/chat/" + this.chatId + "/sendMessage", {}, JSON.stringify(message));
            messageInput.value = '';
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
        const charCount = textarea.value.length;
        document.getElementById('charCount').textContent = charCount;
    }

    setupChatListeners() {
        document.getElementById('messageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        document.getElementById('toggleChat').addEventListener('click', () => {
            this.toggleChatModal();
        });
    }

    toggleChatModal() {
        const modal = document.getElementById('chatModal');
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    }
}