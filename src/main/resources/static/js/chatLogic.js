let stompClient = null;
let chatId, username, participants, userEmail;
let isFirstJoin = true;


document.addEventListener('DOMContentLoaded', function () {
    const chatContainer = document.getElementById('chat-page');
    if (chatContainer) {
        console.log("Chat container found:", chatContainer);
        chatId = chatContainer.dataset.chatId;
        username = chatContainer.dataset.username;
        userEmail = chatContainer.dataset.useremail;
        participants = chatContainer.dataset.participants;

        // Check if user have already logged in to this chat room for the first time (i store variable into localStorage, because every time the page refreshes, it'll be gone. )
        isFirstJoin = !localStorage.getItem(`hasJoined_${chatId}`);
        console.log("Is first join:", isFirstJoin);

        connect();

        document.getElementById('messageForm').addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage();
        });

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
    // Add a delay before redirecting
    setTimeout(() => {
        window.location.href = '/home?chatWasDeleted';
    }, 2000); // after 2 second will redirect to home page with parametr
}

function handleChatCleared() {
    const chatContainer = document.querySelector('.projects-list');
    chatContainer.innerHTML = '';

    const clearedMessageDiv = document.createElement('div');
    clearedMessageDiv.className = 'chat-cleared-message';
    clearedMessageDiv.textContent = 'Chat was cleared';
    chatContainer.appendChild(clearedMessageDiv);
}

function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        subscribeToChat(chatId);
        addUser();

        if (isFirstJoin) {
            sendJoinMessage();
            localStorage.setItem(`hasJoined_${chatId}`, 'true');
        }

        JSON.parse(initialMessages).forEach(showMessage); // display saved messages from database
    }, function (error) {
        console.error('STOMP error:', error);
    });
}

function subscribeToChat(chatId) {
    console.log("Subscribing to chat:", chatId);
    stompClient.subscribe('/topic/chat/' + chatId, function (response) {
        console.log('Received message:', response.body);
        const message = JSON.parse(response.body);
        console.log('Parsed message:', message);
        if (message.type === 'JOIN') {
            console.log("Processing join message");
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
    console.log("Handling deleted message:", message);
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
        inviteTitle.textContent = `${message.author} invites to join conference`
        inviteTitle.style.margin = '0 0 15px 0';
        inviteTitle.style.color = '#002352';

        const connectButton = document.createElement('button');
        connectButton.className = 'btn btn-primary';
        connectButton.style.padding = '8px 20px';
        connectButton.style.fontWeight = 'bold';
        connectButton.style.cursor = 'pointer';
        if (message.type === 'CONFERENCE_INVITATION') {
            connectButton.textContent = 'Connect to the conference';
            connectButton.onclick = () => {
                window.location.href = `/setDevices?userName=${username}&conferenceId=${message.text}`;
            };
        } else {
            console.log("Usernameand message author" , {username ,author: message.author})
                if (username === message.author) {
                connectButton.style.pointerEvents = 'none';
                connectButton.textContent = 'Connect to the chat';
                connectButton.onclick = () => {
                    addUser()
                };
            }
        }


        messageDiv.appendChild(inviteTitle);
        messageDiv.appendChild(connectButton);
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

function addUser() {
    console.log("Adding user to chat:", username, chatId);
    stompClient.send("/app/chat/" + chatId + "/addUser",
        {},
        JSON.stringify({author: username, type: 'JOIN', chat: {id: chatId}}),
        function (response) {
            console.log("Server response to addUser:", response);
            if (response.body) {
                let message = JSON.parse(response.body);
                console.log("Parsed server response:", message);
                if (message) {
                    console.log('User added to chat or chat created');
                    if (message.chat && message.chat.id !== chatId) {
                        chatId = message.chat.id;
                        stompClient.unsubscribe('/topic/chat/' + chatId);
                        subscribeToChat(chatId);
                        console.log("User added to new chat:", chatId);
                        window.history.pushState({}, '', '/chat/' + chatId);
                        isFirstJoin = true;
                    }
                } else {
                    console.log('User already in chat');
                    isFirstJoin = false;
                }
            }
        }
    );
}

function sendMessage() {
    const messageInput = document.getElementById('commentText');
    const messageContent = messageInput.value.trim();
    console.log("Sent message: " + messageContent);
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
        console.log('Json message', JSON.stringify(message))
        messageInput.value = '';
    }
    updateCharCount();
}

function deleteMessage(messageId) {
    console.log("deleteMessage function called with messageId:", messageId);
    console.log("Current chatId:", chatId);
    if (stompClient && messageId && chatId) {
        console.log("Attempting to delete message. ChatId:", chatId, "MessageId:", messageId);
        stompClient.send("/app/chat/" + chatId + "/deleteMessage", {}, JSON.stringify({messageId: messageId}));
    } else {
        console.error("Cannot delete message: stompClient is not connected, messageId is undefined, or chatId is undefined");
        console.log("stompClient:", stompClient);
        console.log("messageId:", messageId);
        console.log("chatId:", chatId);
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

// async function sendFile() {
//     const fileInput = document.getElementById('fileInput');
//     const file = fileInput.files[0];
//
//     if (file) {
//         const formData = new FormData();
//         formData.append('file', file);
//
//         try {
//             const response = await fetch('/api/upload', {
//                 method: 'POST',
//                 body: formData
//             });
//
//             const fileInfo = await response.json();
//
//             const message = {
//                 author: userEmail || username,
//                 text: file.name,
//                 type: 'FILE',
//                 fileUrl: fileInfo.url,
//                 fileName: file.name,
//                 fileType: file.type,
//                 fileSize: file.size
//             };
//
//             stompClient.send("/app/chat/" + chatId + "/sendMessage", {}, JSON.stringify(message));
//         } catch (error) {
//             console.error('Ошибка загрузки файла:', error);
//         }
//     }
// }
