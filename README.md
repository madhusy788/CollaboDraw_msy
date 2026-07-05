
# 🎨 CollabDraw – Real-Time Collaborative Whiteboard

## 📌 Overview

CollabDraw is a full-stack web application that enables multiple users to collaborate on a shared digital whiteboard in real time. The application provides a seamless drawing experience where users can create, edit, and share drawings while communicating with other participants. It is designed to simulate a virtual brainstorming environment, making it suitable for online learning, team collaboration, project discussions, and remote meetings.

The application is developed using **React**, **TypeScript**, **Node.js**, **Express.js**, **MongoDB**, and **Socket.IO**, combining modern web technologies with real-time communication.

---

# ✨ Features

### 🎨 Whiteboard Features

* Freehand Pencil Tool
* Brush Tool
* Eraser
* Rectangle Tool
* Circle Tool
* Straight Line Tool
* Color Picker
* Adjustable Stroke Width
* Clear Canvas
* Smooth Canvas Rendering

### 🤝 Real-Time Collaboration

* Multiple users can join the same board.
* Live synchronization of drawings.
* Real-time updates using Socket.IO.
* Shared collaborative workspace.
* Simultaneous editing without page refresh.

### 👤 User Management

* User Registration
* Secure Login
* JWT Authentication
* Protected Routes
* User Session Management

### 💬 Communication

* Real-Time Chat
* Instant Message Delivery
* Team Collaboration

### 📂 Board Management

* Create New Board
* Join Existing Board
* Save Board Data
* Reload Previous Boards
* Share Board Links

### 📱 User Interface

* Responsive Design
* Modern UI
* Easy Navigation
* Interactive Canvas
* Fast Rendering

---

# 🛠️ Technologies Used

## Frontend

* React
* TypeScript
* Vite
* HTML5 Canvas
* CSS

## Backend

* Node.js
* Express.js
* Socket.IO

## Database

* MongoDB

## Authentication

* JWT (JSON Web Token)

---

# 📁 Project Structure

CollabDraw/
│
├── src/
│   ├── components/
│   │     Reusable UI components such as toolbar,
│   │     canvas, chat panel, navbar, buttons, etc.
│   │
│   ├── pages/
│   │     Application pages like Login,
│   │     Dashboard, Board View, Register, etc.
│   │
│   ├── hooks/
│   │     Custom React Hooks used for state
│   │     management and reusable functionality.
│   │
│   ├── context/
│   │     Global application state using
│   │     React Context API.
│   │
│   ├── services/
│   │     API calls and Socket.IO client
│   │     communication.
│   │
│   ├── utils/
│   │     Utility functions and helper methods.
│   │
│   ├── assets/
│   │     Images, icons, logos, and static files.
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── server/
│   ├── routes/
│   │     REST API endpoints.
│   │
│   ├── sockets/
│   │     Socket.IO event handling for
│   │     collaboration and chat.
│   │
│   ├── middleware/
│   │     Authentication and request validation.
│   │
│   ├── models/
│   │     MongoDB database models.
│   │
│   └── controllers/
│         Business logic for APIs.
│
├── public/
│      Static resources.
│
├── package.json
├── server.ts
├── vite.config.ts
└── README.md


---

# ⚙️ Installation

Clone the repository


git clone https://github.com/yourusername/collabdraw.git


Move into the project folder


cd collabdraw


Install dependencies


npm install


Run the project


npm run dev


Open your browser

http://localhost:3000




# 🛠️ Approach Used

The project follows a **Client-Server Architecture** combined with **WebSocket-based communication** for real-time collaboration.

### Step 1 – User Authentication

Users register and log in securely using JWT authentication. Protected routes ensure that only authenticated users can access collaborative boards.

### Step 2 – Board Creation

A user can create a new board or join an existing board using a unique board ID. Each board acts as a separate collaboration room.

### Step 3 – Real-Time Connection

Once the board is opened, the frontend establishes a Socket.IO connection with the backend server.

### Step 4 – Drawing Synchronization

Whenever a user draws on the canvas, the drawing data is sent to the server through Socket.IO. The server immediately broadcasts the updated drawing information to every connected participant.

### Step 5 – Live Collaboration

All connected users receive the updates instantly and render the drawing on their canvas, ensuring that everyone views the same whiteboard in real time.

### Step 6 – Data Management

REST APIs handle user authentication and board management, while MongoDB stores user and board-related information. Socket.IO manages all live communication.

---

# 🔄 Workflow

```
User Login
      │
      ▼
Authentication
      │
      ▼
Create / Join Board
      │
      ▼
Socket.IO Connection
      │
      ▼
Start Drawing
      │
      ▼
Drawing Events Sent to Server
      │
      ▼
Server Broadcasts Updates
      │
      ▼
All Connected Users Receive Updates
      │
      ▼
Canvas Updated in Real Time
```

---

# 📹 Project Demo

Watch the complete demonstration of **CollabDraw** using the link below:

**🎥 Demo Video:**

https://your-video-link-here

The demo includes:

* User Registration
* User Login
* Dashboard
* Creating a Board
* Joining a Board
* Whiteboard Drawing
* Real-Time Collaboration
* Chat Functionality
* Complete Project Workflow

---

# 📚 What This Project Contains

This project demonstrates the implementation of a complete full-stack collaborative application. It includes:

* Authentication System
* Interactive Whiteboard
* Real-Time Collaboration
* Live Chat
* Board Management
* REST APIs
* Socket.IO Communication
* MongoDB Database Integration
* Responsive User Interface
* Secure User Sessions
* Modern Full-Stack Architecture

---

# 🚀 Future Enhancements

* Voice Chat
* Video Calling
* Sticky Notes
* Image Upload
* Export Board as PDF/PNG
* Undo/Redo Functionality
* Infinite Canvas
* Live Cursor Tracking
* AI-Assisted Drawing
* Mobile Application

---

# 👩‍💻 Author

**Madhu Sravani**

Computer Science Engineering Student

### Skills Demonstrated

* React.js
* TypeScript
* Node.js
* Express.js
* MongoDB
* Socket.IO
* REST APIs
* HTML5 Canvas
* JWT Authentication
* Full-Stack Web Development
* Real-Time Application Development



# 📄 License

This project is developed for educational and learning purposes.

Feel free to fork, modify, and enhance the project.



