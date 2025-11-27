const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
require("dotenv").config();

const { User } = require("../models/User");
const { HttpError } = require("../helpers/index");
const { ctrlWrapper } = require("../decorators/index");

const { JWT_SECRET } = process.env;

const signup = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, "Email already in use");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const verificationToken = nanoid();

  const newUser = await User.create({
    ...req.body,

    password: hashPassword,
    verificationToken,
  });

  res.status(201).json({
    username: newUser.username,
    email: newUser.email,
  });
};

const verify = async (req, res) => {
  const { verificationToken } = req.params;
  const user = await User.findOne({ verificationToken });

  if (!user) {
    throw HttpError(404, "Email not found");
  }

  const hashToken = await bcrypt.hash(verificationToken, 10);
  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationToken: hashToken,
  });

  res.json({
    message: "Email verify success",
  });
};

const signin = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, "Email is invalid");
  }

  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Password is invalid");
  }
  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "23h",
  });

  await User.findByIdAndUpdate(user._id, { token });
  res.json({
    token,
  });
};

const getCurrent = async (req, res) => {
  const { username, email } = req.user;
  res.json({ username, email });
};

const updateUsername = async (req, res) => {
  const { _id } = req.user;
  const { username } = req.body;

  if (!username?.trim()) {
    throw HttpError(400, "Username is required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    _id,
    { username },
    { new: true }
  );
  if (!updatedUser) {
    throw HttpError(404, "User not found");
  }

  res.json({
    username: updatedUser.username,
  });
};

const signout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });
  res.json({ message: "Logout success" });
};

module.exports = {
  signup: ctrlWrapper(signup),
  verify: ctrlWrapper(verify),
  signin: ctrlWrapper(signin),
  getCurrent: ctrlWrapper(getCurrent),
  updateUsername: ctrlWrapper(updateUsername),
  signout: ctrlWrapper(signout),
};
