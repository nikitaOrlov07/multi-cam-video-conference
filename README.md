![image](https://github.com/user-attachments/assets/26331d1c-51e3-4f6a-b14d-4da203583062)![image](https://github.com/user-attachments/assets/181172ee-1797-4024-9250-d6da6472415d)# 🎥 Multi-Camera Video Conference Application

This repository contains a **video conferencing application** that supports **multiple cameras per user** and various advanced features for real-time control and collaboration.

---

---

## ⚙️ Functionality

This section describes the functionality of the developed application:

- **Multi-camera and microphone support**: Users can join video conferences with multiple cameras and a microphone. It is also possible to join a conference without a camera or microphone.

- **Camera manipulation**: Cameras can be moved within a section, hidden, removed, or expanded to fullscreen. Users can dynamically add or remove their cameras during the conference. Screen sharing is also supported during the session.

- **Conference access**: Both authenticated users and guests can create new conferences or join existing ones.

- **User section control**: User sections (which display camera streams) can be moved around the screen, enlarged, or displayed fullscreen.

- **Cross-device compatibility**: The application is accessible from various devices (phones, tablets, desktops, etc.) and provides a user-friendly and intuitive interface.

- **Multi-device login for authorized users**: Authenticated users can join a single conference from multiple devices simultaneously. The number of active devices per account is displayed in the user list.

- **Custom display selection**: Users can choose which participants are displayed on their screen — allowing for personalized views across different devices.

- **Registration and authentication**: After authentication, users gain access to additional features such as viewing previous conferences and chats, starting new chats, and using saved device configurations. User accounts can be of two types:  
  - `"Permanent"` — for registered users  
  - `"Temporary"` — for guest users  
  Authorized users can also view, edit, or delete their account information.

- **Guest access**: Guests can join by simply entering a name. Guests cannot use private chats but can participate in conference chats. Their account is deleted after leaving the conference.

- **Chat functionality**: Supports both private (one-on-one) chats and conference-wide chats.

- **User roles**: The application defines three roles — User, Creator, and Administrator.  
  Creators and Administrators have access to the **Admin Page**, where they can:
  - View, create, edit, and delete users  
  - View and modify global settings (e.g., timeout for removing unused conferences or temporary users)  
  - View all conferences with metadata (status, creation date, list of users), and join any of them

- **Conference security**: Conferences can be protected with passwords. By default, a conference is created without a password, but it can be set or changed on the conference page.

- **Invitations**: Users can invite others to a conference. An invitation link appears in the chat — when clicked, it redirects the recipient to the device configuration page with the conference ID prefilled.


---

## 🛠️ Technologies Used

This is a **monolithic project** – the backend and frontend are located in a single repository.

### 📦 Backend
- Java (Spring Boot)

### 🎨 Frontend
- HTML, CSS, JavaScript

### 📡 Video Transmission
- Jitsi API (only for video streaming; custom frontend is used)

### 🐳 Docker
Used for containerizing:
- Application
- Database
- Jitsi-related services

### 🗄️ Database
- PostgreSQL

---

## 🐳 Docker Containers
![image](https://github.com/user-attachments/assets/7666398c-d850-4948-89d2-316eb8ad4f78)

- **app** – The main application container, built using a custom Dockerfile.
- **db** – PostgreSQL database container.
- **jicofo** – Manages coordination of media streams between participants.
- **jitsi-web** – Handles user interactions and provides the frontend interface for Jitsi (although a custom frontend is used, this container is required for proper Jitsi API functioning).
- **prosody** – Responsible for message routing between components (clients, Jicofo, JVB).
- **jvb** – Manages media transmission and processing between participants.
- **coturn** – Facilitates client connectivity through NAT/firewall.

---
## Application Structure
![image](https://github.com/user-attachments/assets/ee1ac32f-825f-461f-8c47-2db0eafbbe49)
![image](https://github.com/user-attachments/assets/bbac5ae8-8f0c-4fb8-bd41-5c1888ace3da)

---
## 🧩 Database Schema

### 🧑 `users`
![image](https://github.com/user-attachments/assets/21f37249-2321-483f-a6e5-5251c864a75f)
Stores user data:
- First name, last name, email, encrypted password (via `BCryptPasswordEncoder()`), city, country, street
- Account type (temporary or permanent)
- Creation timestamp

### 🛡️ `role_entity`
Defines available user roles:
- `id`, `name` (creator, admin, regular user)

### 🔄 `users_role`
Many-to-many table connecting users and their roles.

### 💬 `chats`
Represents chat sessions (`chat_id`).

### 👥 `users_chats`
Associates users with chats (`user_id`, `chat_id`).

### ✉️ `message`
Stores messages:
- Text, author, timestamp, and message type
  - (chat message, user join, message deleted, chat cleared, chat deleted, etc.)

### 🏢 `conference`
Stores conference metadata:
- Password and creation time

### 🔗 `user_conference`
Joins users and their conferences.

### 🎥 `conference_devices`
Stores microphone and selected cameras (as JSON strings), including:
- Microphone ID and label
- JSON list of cameras (`id`, `label`)
- Username and conference ID

### ⚙️ `settings`
Stores customizable admin settings:
- Type, value, user ID, user email, and creation/modification timestamps

---
## 📽️ Video Transmission Principle

Due to a **limitation of the Jitsi API**, each client can only send **one video stream at a time**.  
To enable **multiple cameras per user**, the application uses a concept of **"technical users"**:

- Each additional camera is handled by a **separate virtual client** (technical user).
- These technical users are **invisible in the interface** but are responsible for transmitting video from secondary cameras.
- The main user controls these streams dynamically – adding/removing them as needed.

This architecture enables rich multi-camera experiences while working around Jitsi’s API limitations.

---
## 🧰 Installation & Run

To run the application:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nikitaOrlov07/3D-video-conferencing-system

2. **Requirements**:
    Java (version 23.0.2 is used) , Docker , IDE (e.g., IntelliJ IDEA)
3. **Create Docker Containers**:
    docker compose up
4. **Run the application**

## 🖼️ Screenshots
### 🔹 Conference Page
![image](https://github.com/user-attachments/assets/9d1d6a18-a678-4392-9f56-d3a936ede09a)

### Conference Chat Page
![image](https://github.com/user-attachments/assets/60a4a2c2-dba5-4180-acb3-097ddf3b5223)

### Personal Chat Page
![image](https://github.com/user-attachments/assets/c92d077e-7e50-4d02-bc67-c723fbce64cc)

### Initial Device Setting Pape
![image](https://github.com/user-attachments/assets/d71b745e-4acf-4422-a62a-ed82cbef1d7c)

### Initial Page (for authorized users)
![image](https://github.com/user-attachments/assets/8e7b6600-ba67-44f9-98f1-3350f5c75d65)
![image](https://github.com/user-attachments/assets/b66341f7-f170-499c-88c7-02efc50134ed)

### Initial Page (for unauthorized users)
![image](https://github.com/user-attachments/assets/df131bce-fe4d-4b75-8712-ea19168f5938)

### Login modal Window
![image](https://github.com/user-attachments/assets/f07e408a-7f6d-40b5-867a-c7e7890b1955)

### Registration Page
![image](https://github.com/user-attachments/assets/937f606b-d110-41bb-8c60-4c0b20644ec1)

### Controle Page
![image](https://github.com/user-attachments/assets/be34192d-a960-4587-a5a2-c16253e21f69)
![image](https://github.com/user-attachments/assets/679f6b81-da5c-4e42-9f71-f02516619956)






