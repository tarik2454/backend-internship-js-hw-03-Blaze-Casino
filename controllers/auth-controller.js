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
  const { username, email, balance, totalWagered, gamesPlayed, totalWon } =
    req.user;

  res.json({
    username,
    email,
    balance,
    totalWagered,
    gamesPlayed,
    totalWon,
  });
};

const updateUser = async (req, res) => {
  const { username, balance, totalWagered, gamesPlayed, totalWon } = req.body;

  const updateData = {};
  if (username) updateData.username = username;
  if (balance !== undefined) updateData.balance = balance;
  if (totalWagered !== undefined) updateData.totalWagered = totalWagered;
  if (gamesPlayed !== undefined) updateData.gamesPlayed = gamesPlayed;
  if (totalWon !== undefined) updateData.totalWon = totalWon;

  const updated = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
  }).select("username email balance totalWagered gamesPlayed totalWon");

  if (!updated) {
    throw HttpError(404, "User not found");
  }

  res.json(updated);
};

const getAllUsers = async (req, res) => {
  const users = await User.find({}, "username gamesPlayed balance");

  res.json(users);
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
  getAllUsers: ctrlWrapper(getAllUsers),
  updateUser: ctrlWrapper(updateUser),
  signout: ctrlWrapper(signout),
};
