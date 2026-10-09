import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//POST use to api test
const createUser = async (req, res) => {
  try {
    const { username, email,password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

const user = await User.create({
    username,
    email,
    password: hashedPassword
});//uses our Mongoose User model to insert the data into MongoDB.


    const userResponse = user.toObject();
    delete userResponse.password;
    /*
    MongoDB:
username
email
password ← stored

API response:
username
email
password ← removed
    */

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse//means this never response the password in the postman 
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
const getUsers = async (req, res) => {
  try {
    const users = await User.find();

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      users
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


//PATCH -> it only chage the value it vijay t king
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.userId !== id) {
  return res.status(403).json({
    success: false,
    message: "You can only update your own account"
  });
}
    const { username, email } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        username,
        email,
        
      },
      {
  new: true,
  runValidators: true
}
    );
   
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


//DELETE
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
        if (req.user.userId !== id) {
  return res.status(403).json({
    success: false,
    message: "You can only update your own account"
  });
}

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
//loginUser
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // 2. Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 3. Compare password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    const token = jwt.sign(
  { userId: user._id },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }//means the token expires after 1 day.
);

    // 4. Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // 5. Login successful
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export { createUser, getUsers,updateUser,deleteUser,loginUser, getMyProfile};

