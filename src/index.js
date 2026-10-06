/*
Think of index.js as the main entry point / manager of your backend application
index.js
   │
   ├── Express
   ├── Middleware
   ├── Database connection
   ├── Routes
   └── Server

                       CLIENT
                  (Postman)
                      │
                      ↓
                 index.js
              ┌───────┴───────┐
              │               │
          Middleware       Routes
                              │
                              ↓
                       user.routes.js
                              │
                              ↓
                    user.controller.js
                              │
                              ↓
                       User Model
                              │
                              ↓
                           MongoDB
index.js
Main manager
"Start the application and connect everything."

routes/user.routes.js
Traffic controller
"Which function should handle this request?"

controllers/user.controller.js
Logic
"What should happen?"

models/user.model.js
Database structure + database operations
"How is a User stored/interacted with?"

MongoDB
Actual database
"Where is the data stored?"
*/