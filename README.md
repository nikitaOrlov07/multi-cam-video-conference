# 🎥 Multi-Camera Video Conference Application

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
#### Functionality of the Page

- Communicate with other users via video and audio streams.
- Select which users are displayed on the conference page.
- Set or change the conference password.
- Send invitations to join the conference.
- Dynamically add or remove cameras during the session.
- Share the screen.
- Move, resize, restore, or fullscreen user sections.
- Move cameras within user sections.
- Enlarge, hide, or remove cameras from the screen.
- Join a conference without microphones or cameras; communicate with multiple cameras but only one microphone.
- Use chat functionality within the conference.
- When clicking "Share Screen," a browser window opens to select what to share.

Data received from the server includes:
- Initial device configurations
- Usernames
- List of users and count of their active devices in the conference
- Conference password
- List of all users

The client-side application communicates with the Jitsi API via JavaScript.
### Conference Chat Page
![image](https://github.com/user-attachments/assets/60a4a2c2-dba5-4180-acb3-097ddf3b5223)

Users can view and send messages in real time on this page. Existing messages are fetched from the server and stored in the database. Most of the messaging logic is implemented using JavaScript on the client side.

### Personal Chat Page
![image](https://github.com/user-attachments/assets/c92d077e-7e50-4d02-bc67-c723fbce64cc)

#### Features:

- Real-time display of messages  
- Sending messages  
- Deleting messages (only own messages)  
- Deleting entire chats  
- Clearing all messages in a chat  
- Navigating to a conference (if the message type is **INVITE**)

The real-time messaging uses WebSocket configuration (detailed description available in *WebSocket Configuration*).  
Most of the chat logic is implemented in JavaScript (*see `chatLogic.js`*).

##### Message Types

- Chat messages  
- User joined chat notifications  
- Message deletion notifications  
- Chat cleared notifications  
- Chat message deletion notifications  
- User joined chat notifications

Each message type has its own handler method in the JavaScript code.

On the server side, chat messages are stored in the database and loaded when a user accesses the chat.

When a chat is deleted, users receive a notification, and are redirected to the main page. This also redirects the other user if they are in the chat. The chat and all its messages are removed from the database.

When a chat is cleared, users are notified, and all messages are deleted from the database.

##### Security

- Users cannot enter, clear, or delete chats they are not members of.  
- Users cannot delete messages they do not own.

##### Notes

- Document forwarding in chat is not implemented due to time constraints.  
- Personal chats are available only for authorized users.


### Initial Device Setting Pape
![image](https://github.com/user-attachments/assets/d71b745e-4acf-4422-a62a-ed82cbef1d7c)
#### Features:

- **"Without Cameras" Checkbox**  
  When checked, the camera section is removed, allowing the user to join the conference without a camera.  
  If unchecked, the user must select at least one camera.

- **"Without Microphones" Checkbox**  
  When checked, the microphone section is removed, allowing the user to join the conference without a microphone.  
  If unchecked, the user must select at least one microphone.

- Cameras and microphones are displayed dynamically using the `device-settings.js` script.

- The page shows video streams from all available cameras and provides microphone testing functionality:  
  Users can record audio directly on the page while watching a real-time waveform (audio amplitude graph).  
  After stopping the recording, the audio playback is available.

- For **authorized users** (with a **Permanent** account type), previously saved device configurations are available to browse. Each configuration is unique and loaded from the backend.
### Initial Page (for authorized users)
![image](https://github.com/user-attachments/assets/8e7b6600-ba67-44f9-98f1-3350f5c75d65)
![image](https://github.com/user-attachments/assets/b66341f7-f170-499c-88c7-02efc50134ed)

#### Functionality
This section describes the main features of the application:

- Supports communication using multiple cameras and microphones. Users can also join a conference without cameras and microphones.

- Camera management: cameras can be moved within sections, removed, hidden, and enlarged. Users can dynamically add or remove their own cameras during the conference. Screen sharing is also supported.

- Users (both authorized and guests) can start a new conference or join an existing one.

- User sections (where cameras are displayed) can be moved, fullscreened, and resized.

- The application is usable on various devices (phones, tablets, computers) and has a user-friendly interface.

- Authorized users can log into the conference from multiple devices simultaneously. The number of devices connected from one account is shown in the user list.

- Users can select which participants to display on the conference page — different users can be viewed on different devices.

- Registration and authorization are available. After login, users gain access to more features such as viewing their past conferences and chats, creating new chats, and using saved device configurations. User accounts have a type attribute: **Permanent** for registered users, **Temporary** for guests. Authorized users can also view, edit, and delete their accounts.

- Guests can join by simply entering a name. Guests cannot use personal chats but can participate in conference chats. Guest accounts are deleted after leaving the conference.

- Existing chats include personal chats between two users and conference chats.

- Roles system: **User**, **Creator**, and **Admin**. Creators and admins have access to the admin page where they can view, create, update, and delete users, manage global settings (e.g., cleanup intervals for unused conferences and temporary users), and view and manage all conferences (including their status, creation date, and participant list). They can also join conferences from this page.

- Conference security: passwords are supported. By default, conferences are created without a password, but a password can be set or changed on the conference page.

- Users can invite others to conferences by sending special chat messages. Clicking these messages redirects the recipient to the device setup page with the conference ID prefilled.

### Initial Page (for unauthorized users)
![image](https://github.com/user-attachments/assets/df131bce-fe4d-4b75-8712-ea19168f5938)

#### On this page, three buttons are available:
- **Log In**  
  Opens a modal window with fields for username and password, allowing the user to log into their account.

- **Register**  
  Redirects to the registration page.

- **Start Conference**  
  Opens a modal window where the user enters their name and proceeds to the device setup page.  
  After selecting devices, a temporary account is created with the username provided. This account type is **Temporary** and will be deleted after the conference ends.
  
### Login modal Window
![image](https://github.com/user-attachments/assets/f07e408a-7f6d-40b5-867a-c7e7890b1955)

The user must enter an email and a password (the password is hidden as it is typed). If they do not match, the server sends an error which is displayed in a modal window.

### Registration Page
![image](https://github.com/user-attachments/assets/937f606b-d110-41bb-8c60-4c0b20644ec1)

The user sets their first name, last name, email, password, city, country, and address.
Server-side validation is performed for the first name, last name, email, and password fields. The validation checks that the data is not empty and does not contain only whitespace. Validation errors are displayed on the page next to the corresponding fields.
After successful validation, the data is saved to the database. The password is stored in encrypted form, and the user account type is set to PERMANENT.

### Controle Page
![image](https://github.com/user-attachments/assets/be34192d-a960-4587-a5a2-c16253e21f69)
![image](https://github.com/user-attachments/assets/679f6b81-da5c-4e42-9f71-f02516619956)

#### Functionality of the Page
- Access restricted to users with **Admin** or **Creator** roles.
- **User Management**:  
  - View a detailed list of users with last name, first name, email, account type (Permanent or Temporary), role, and location (country, city, street).  
  - Add new users via a modal form with required (first name, last name, email, password, role) and optional fields (country, city, address).  
  - Edit existing users through a modal dialog with pre-filled data.  
  - Delete users with confirmation.

- **Global Settings**:  
  - View all global settings (e.g., time intervals for deleting unused conferences).  
  - Edit setting values and add new settings.

- **Conference Management**:  
  - View a list of all conferences with ID, creation date, and status (active/inactive).  
  - Leave or delete conferences (deletion only if user is not part of it).  
  - Join conferences directly or via the device setup page with pre-filled conference ID.






