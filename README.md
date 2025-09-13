# Instagram Clone

A full-stack Instagram clone built with Next.js (frontend) and Express.js (backend) featuring user authentication, JWT tokens, and MongoDB integration.

## 🚀 Features

- **User Authentication**: Register and login with JWT tokens
- **Secure Password Hashing**: Using bcryptjs for password security
- **Protected Routes**: JWT-based route protection
- **Responsive Design**: Instagram-like UI that works on all devices
- **MongoDB Integration**: User data storage with Mongoose
- **Token Management**: Automatic token validation and refresh
- **Error Handling**: Comprehensive error handling on both frontend and backend

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token generation and verification
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Frontend
- **Next.js 15** - React framework
- **React 19** - UI library
- **Axios** - HTTP client
- **jwt-decode** - JWT token decoding
- **CSS Modules** - Styling

## 📁 Project Structure

```
instagram-clone/
├── insta-backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── .env              # Environment variables
└── insta-frontend/
    ├── src/
    │   ├── app/
    │   │   ├── login/     # Login page
    │   │   ├── signup/    # Signup page
    │   │   ├── dashboard/ # Protected dashboard
    │   │   └── layout.tsx # Root layout
    │   └── utils/
    │       └── auth.js    # Authentication utilities
    └── package.json       # Frontend dependencies
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB installation
- Git

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd instagram-clone
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd insta-backend

# Install dependencies (already done)
npm install

# Configure environment variables
# Edit .env file with your MongoDB URI and JWT secret
```

**Environment Variables (.env):**
```env
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/instagram-clone?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
NODE_ENV=development
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../insta-frontend

# Install dependencies (already done)
npm install
```

### 4. MongoDB Setup

1. Create a MongoDB Atlas account at [mongodb.com](https://www.mongodb.com/)
2. Create a new cluster
3. Create a database user
4. Get your connection string
5. Replace the `MONGODB_URI` in the backend `.env` file

### 5. Running the Application

**Start the Backend (Port 5000):**
```bash
cd insta-backend
npm run dev
```

**Start the Frontend (Port 3000):**
```bash
cd insta-frontend
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

## 📱 Usage

1. **Register**: Create a new account at `/signup`
2. **Login**: Sign in at `/login`
3. **Dashboard**: Access protected content at `/dashboard`
4. **Logout**: Use the logout button to end your session

## 🔐 API Endpoints

### Authentication Routes

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile (protected)

### Test Routes

- `GET /api/test` - Test backend connection
- `GET /api/protected` - Test protected route (requires JWT)

## 🔒 Security Features

- **Password Hashing**: All passwords are hashed using bcryptjs with salt rounds
- **JWT Tokens**: Secure token-based authentication with 7-day expiration
- **Protected Routes**: Frontend and backend route protection
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Input Validation**: Server-side validation for all user inputs
- **Error Handling**: Secure error messages that don't leak sensitive information

## 🎨 UI Features

- **Instagram-like Design**: Authentic Instagram visual styling
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Loading States**: User feedback during API calls
- **Error Messages**: Clear error handling and user feedback
- **Form Validation**: Client-side and server-side validation

## 🚧 Coming Soon

- 📸 Photo and video uploads with Cloudinary
- 📱 Feed with posts from followed users
- ❤️ Like and comment system
- 👥 Follow/unfollow functionality
- 🔍 User and post search
- 📖 Stories feature
- 💬 Direct messaging
- 🔔 Real-time notifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your MongoDB URI in the `.env` file
   - Ensure your IP is whitelisted in MongoDB Atlas
   - Verify database user credentials

2. **JWT Token Issues**
   - Clear localStorage in browser developer tools
   - Check if JWT_SECRET is set in backend `.env`

3. **CORS Errors**
   - Ensure backend is running on port 5000
   - Check CORS configuration in `server.js`

4. **Port Already in Use**
   - Kill existing processes: `npx kill-port 3000` or `npx kill-port 5000`
   - Or change ports in the respective configuration files

## 📞 Support

If you encounter any issues or have questions, please open an issue in the repository.

---

**Happy Coding! 🎉**