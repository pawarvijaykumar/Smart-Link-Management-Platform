
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require("./routes/user.routes").default;
const healthRoutes = require('./routes/health.routes');
const uploadRoutes = require("./routes/upload.routes").default;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes-->"When someone sends a GET request to this URL, what should I do?"
app.use('/api', healthRoutes);//its show api testing 
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/upload", uploadRoutes);
// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
/*

Postman
   ↓
POST /api/v1/users/register
   ↓
app.js
   ↓
/api/v1/users
   ↓
user.routes.js
   ↓
/register
   ↓
createUser()
   ↓
User.create()
   ↓
MongoDB*/