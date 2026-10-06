import { User } from "../models/user.model.js";

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

export { createUser };