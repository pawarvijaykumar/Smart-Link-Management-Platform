import { User } from "../models/user.model.js";
//POST use to api test
const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;

    const user = await User.create({
      username,
      email,
      
    });//uses our Mongoose User model to insert the data into MongoDB.

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user
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

    const { username, email } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        username,
        email,
        
      },
      {
        new: true
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

export { createUser, getUsers,updateUser,deleteUser };

