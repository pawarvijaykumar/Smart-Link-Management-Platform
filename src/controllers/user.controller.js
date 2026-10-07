import { User } from "../models/user.model.js";
//POST use to api test
const createUser = async (req, res) => {
  try {
    const { name, email, password, age } = req.body;

    const user = await User.create({
      name,
      email,
      password,
      age
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

    const { name, email, age } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        name,
        email,
        age
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
export { createUser, getUsers,updateUser };

