let stompClient = null;
let chatId, username, participants, userEmail;
let isFirstJoin = true;


document.addEventListener('DOMContentLoaded', function () {
    const chatContainer = document.getElementById('chat-page');
    if (chatContainer) {
        chatId = chatContainer.dataset.chatId;
        username = chatContainer.dataset.username;
        userEmail = chatContainer.dataset.useremail;
        participants = chatContainer.dataset.participants;

        // Check if user have already logged in to this chat room for the first time (i store variable into localStorage, because every time the page refreshes, it'll be gone. )
        isFirstJoin = !localStorage.getItem(`hasJoined_${chatId}`);

        connect();

        const deleteChatForm = document.getElementById('deleteChatForm');
        if (deleteChatForm) {
            deleteChatForm.addEventListener('submit', function (e) {
                e.preventDefault();
                if (confirmAction("Are you sure you want to delete this?")) {
                    deleteChat();
                }
            });
        }

        document.getElementById('clearChatForm').addEventListener('submit', function (e) {
            e.preventDefault();
            if (confirmAction("Are you sure you want to clear chat?")) {
                clearChat();
            }
        });

        // Initialize character counter
        updateCharCount();
    } else {
        console.error('Element with id "chat-page" not found');
    }
});

function handleChatDeleted() {
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

    const deleteChatForm = document.querySelector('form[action$="/delete"]');
    if (deleteChatForm) {
        deleteChatForm.style.display = 'none';
    }

    setTimeout(() => {
        window.location.href = '/home?chatWasDeleted';
    }, 2000);
}

function handleChatCleared() {
    const chatContainer = document.querySelector('.projects-list');
    chatContainer.innerHTML = '';

    const clearedMessageDiv = document.createElement('div');
    clearedMessageDiv.className = 'chat-cleared-message';
    clearedMessageDiv.textContent = 'Chat was cleared';
    chatContainer.appendChild(clearedMessageDiv);

    setTimeout(() => {
        clearedMessageDiv.remove()
    }, 5000)
}

function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        addUserToTheChat()

        if (isFirstJoin) {
            sendJoinMessage();
            localStorage.setItem(`hasJoined_${chatId}`, 'true');
        }

        JSON.parse(initialMessages).forEach(showMessage); // display saved messages from database
    }, function (error) {
        console.error('STOMP error:', error);
    });
}

function addUserToTheChat(newChatId) {
    const targetChatId = newChatId != null ? newChatId : chatId;

    if (targetChatId !== chatId) {
        console.log("Redirect to new chat");

        addUserAndWait(targetChatId)
            .then(() => {
                console.log("User added successfully, redirecting...");
                window.location.href = '/chat/' + targetChatId;
            })
            .catch((error) => {
                console.error("Failed to add user:", error);
                window.location.href = '/chat/' + targetChatId;
            });
        return;
    }

    subscribeToChat(targetChatId);
    addUser(targetChatId);
}

function addUserAndWait(targetChatId) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        const subscription = stompClient.subscribe('/topic/chat/' + targetChatId, function (message) {
            if (resolved) return;
            const messageData = JSON.parse(message.body);
            if (messageData.type === 'JOIN' && messageData.author === username) {
                resolved = true;
                subscription.unsubscribe();
                setTimeout(() => resolve(), 200);
            }
        });
        addUser(targetChatId, true);
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                subscription.unsubscribe();
                reject(new Error("Timeout waiting for user to be added"));
            }
        }, 4000);
    });
}

function subscribeToChat(chatId) {
    stompClient.subscribe('/topic/chat/' + chatId, function (response) {
        const message = JSON.parse(response.body);
        if (message.type === 'JOIN') {
            showMessage(message);
        } else if (message.type === 'DELETE') {
            handleDeletedMessage(message);
        } else if (message.type === 'CHAT_DELETED') {
            handleChatDeleted();
        } else if (message.type === 'CLEAR') {
            handleChatCleared();
        } else {
            showMessage(message);
        }
    });
}

function handleDeletedMessage(message) {
    const messageId = message.text;
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    } else {
        console.error("Could not find message element to delete");
    }
}

function sendJoinMessage() {
    if (stompClient && stompClient.connected) {
        const joinMessage = {
            author: username,
            text: `${username} has entered the chat`,
            type: 'JOIN'
        };
        stompClient.send("/app/chat/" + chatId + "/sendMessage", {}, JSON.stringify(joinMessage));
    } else {
        console.error("Cannot send join message: stompClient is not connected");
    }
}

function confirmAction(message) {
    return confirm(message)
}

function showMessage(message) {
    if (!message.text || message.text.trim() === '') {
        console.log('Received empty message:', message);
        return;
    }

    const chatContainer = document.querySelector('.projects-list');
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
    } else if (message.type === 'CONFERENCE_INVITATION' || message.type === 'CHAT_INVITATION') {
        messageDiv.className = "invitation-message";
        messageDiv.style.textAlign = 'center';
        messageDiv.style.backgroundColor = '#e6f3ff';
        messageDiv.style.padding = '15px';
        messageDiv.style.borderRadius = '10px';
        messageDiv.style.margin = '10px 0';
        messageDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        messageDiv.style.border = '1px solid #b8daff';
        messageDiv.style.width = 'fit';
        messageDiv.style.height = 'fit';

        const inviteTitle = document.createElement('h4');
        const connectButton = document.createElement('button');
        connectButton.className = 'btn btn-primary';
        connectButton.style.padding = '8px 20px';
        connectButton.style.fontWeight = 'bold';
        connectButton.style.cursor = 'pointer';
        if (message.type === 'CONFERENCE_INVITATION') {
            inviteTitle.textContent = `${message.author} invites to join conference`
            inviteTitle.style.margin = '0 0 15px 0';
            inviteTitle.style.color = '#002352';
            connectButton.textContent = 'Connect to the conference';
            connectButton.onclick = () => {
                window.location.href = `/setDeices?userName=${username}&conferenceId=${message.text}`;
            };
        } else {
            inviteTitle.textContent = `${message.author} invites to join chat`
            inviteTitle.style.margin = '0 0 15px 0';
            inviteTitle.style.color = '#002352';
            connectButton.textContent = 'Connect to the chat';
            connectButton.onclick = () => {
                addUserToTheChat(message.text)
            };
        }
        messageDiv.appendChild(inviteTitle);
        messageDiv.appendChild(connectButton);
    } else if (message.type === 'MESSAGE_WITH_FILE') {
        const messageContent = document.createElement('div');
        messageContent.dataset.messageId = message.id;

        const authorParagraph = document.createElement('p');
        const textParagraph = document.createElement('p');
        const dateParagraph = document.createElement('p');
        const fileContainer = document.createElement('div');

        authorParagraph.className = 'message-author';
        textParagraph.className = 'message-text';
        dateParagraph.className = 'message-text';
        fileContainer.className = 'file-container';

        textParagraph.textContent = message.text || '';
        dateParagraph.textContent = message.pubDate;

        const downloadButton = document.createElement('a');
        downloadButton.href = message.downloadUrl;
        downloadButton.download = message.fileName;
        downloadButton.textContent = '⬇ Download';
        downloadButton.className = 'download-button';

        let imgPreview = null;

        if (message.viewUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(message.fileName)) {
            imgPreview = document.createElement('img');
            imgPreview.src = message.viewUrl;
            imgPreview.alt = message.fileName;
            imgPreview.className = 'file-preview';
            imgPreview.style.cursor = 'pointer';
            fileContainer.appendChild(imgPreview);
        } else {
            const fileLink = document.createElement('a');
            fileLink.href = message.viewUrl;
            fileLink.textContent = message.fileName;
            fileLink.target = '_blank';
            fileContainer.appendChild(fileLink);
        }

        fileContainer.appendChild(downloadButton);

        if (message.author === username || message.author === userEmail) {
            messageContent.className = 'message message-right';
            authorParagraph.textContent = 'You:';
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-message-btn';
            deleteButton.textContent = '✕';
            deleteButton.title = 'Delete message';
            deleteButton.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (confirmAction('Delete this message?')) {
                    deleteMessage(message.id);
                }
            };
            messageContent.appendChild(deleteButton);
        } else {
            messageContent.className = 'message message-left';
            authorParagraph.textContent = message.author;
        }

        if (imgPreview) {
            let imageModal = document.getElementById('image-modal');

            if (!imageModal) {
                imageModal = document.createElement('div');
                imageModal.id = 'image-modal';
                imageModal.style.position = 'fixed';
                imageModal.style.top = '0';
                imageModal.style.left = '0';
                imageModal.style.width = '100%';
                imageModal.style.height = '100%';
                imageModal.style.backgroundColor = 'rgba(0,0,0,0.8)';
                imageModal.style.display = 'none';
                imageModal.style.alignItems = 'center';
                imageModal.style.justifyContent = 'center';
                imageModal.style.zIndex = '1000';

                const modalImage = document.createElement('img');
                modalImage.id = 'modal-image';
                modalImage.style.maxWidth = '90%';
                modalImage.style.maxHeight = '90%';
                modalImage.style.borderRadius = '10px';
                modalImage.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
                imageModal.appendChild(modalImage);

                imageModal.addEventListener('click', () => {
                    imageModal.style.display = 'none';
                });

                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape' && imageModal.style.display === 'flex') {
                        imageModal.style.display = 'none';
                    }
                });

                document.body.appendChild(imageModal);
            }

            imgPreview.addEventListener('dblclick', () => {
                const modalImage = document.getElementById('modal-image');
                modalImage.src = imgPreview.src;
                modalImage.alt = imgPreview.alt;
                imageModal.style.display = 'flex';
            });
        }

        messageContent.appendChild(authorParagraph);
        messageContent.appendChild(textParagraph);
        messageContent.appendChild(fileContainer);
        messageContent.appendChild(dateParagraph);
        chatContainer.appendChild(messageContent);
    } else {
        const messageContent = document.createElement('div');
        const authorParagraph = document.createElement('p');
        const textParagraph = document.createElement('p');
        const dateParagraph = document.createElement('p');
        authorParagraph.className = 'message-author';
        textParagraph.className = 'message-text';
        dateParagraph.className = 'message-text';
        if (message.author === username || message.author === userEmail) {
            messageDiv.className = 'message message-right';
            authorParagraph.textContent = 'You:';
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-message-btn';
            deleteButton.textContent = '✕';
            deleteButton.title = 'Delete message';
            deleteButton.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (confirmAction('Delete this message?')) {
                    deleteMessage(message.id);
                }
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

function addUser(targetChatId, addInvitation) {
    const destination = "/app/chat/" + targetChatId + "/addUser";
    stompClient.send(destination, {}, JSON.stringify({author: username, type: 'JOIN', invitation: addInvitation}));

}

function sendMessage() {
    const messageInput = document.getElementById('commentText');
    const messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        let message
        if (userEmail && userEmail.trim() !== '') // userEmail -> check if not null and not undefined
        {
            message = {
                author: userEmail,
                text: messageContent,
                type: 'CHAT'
            }
        } else {
            message = {
                author: username,
                text: messageContent,
                type: 'CHAT'
            }
        }
        stompClient.send("/app/chat/" + chatId + "/sendMessage", {}, JSON.stringify(message));
        messageInput.value = '';
    }
    updateCharCount();
}

function deleteMessage(messageId) {
    if (stompClient && messageId && chatId) {
        stompClient.send("/app/chat/" + chatId + "/deleteMessage", {}, JSON.stringify({messageId: messageId}));
    } else {
        console.error("Cannot delete message: stompClient is not connected, messageId is undefined, or chatId is undefined");
    }
}

function deleteChat() {
    if (stompClient && stompClient.connected) {
        stompClient.send("/app/chat/" + chatId + "/delete", {}, JSON.stringify({chatId: chatId}));
    } else {
        console.error("Cannot delete chat: stompClient is not connected");
    }
}

function clearChat() {
    if (stompClient && stompClient.connected) {
        stompClient.send("/app/chat/" + chatId + "/clear", {}, JSON.stringify({chatId: chatId}));
    } else {
        console.error("Cannot clear chat: stompClient is not connected");
    }
}

function updateCharCount() {
    const textarea = document.getElementById('commentText');
    const charCount = textarea.value.length;
    document.getElementById('charCount').textContent = charCount;
}