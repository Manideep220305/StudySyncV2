const User = require('../models/User');
const jwt = require('jsonwebtoken');

// --- Helper Function ---
// We keep this separate to reuse it in both register and login
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token valid for 30 days
    });
};

// --- REGISTER USER ---
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Validation: Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 2. Create User (Middleware in User.js handles the password hashing)
        const user = await User.create({
            username,
            email,
            password,
        });

        // 3. Generate Token
        const token = generateToken(user._id);

        // 4. Send Token in HTTP-Only Cookie
        res.cookie('jwt', token, {
            httpOnly: true, // Prevents client-side JS from accessing the cookie
            secure: process.env.NODE_ENV === 'production', // Only sends over HTTPS in production
            sameSite: 'strict', // Prevents CSRF attacks
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        });

        // 5. Send Response (excluding password)
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: 'user', // You can change this later for 'admin' logic
        });

    } catch (error) {
        console.error(error); // Log error for debugging
        res.status(500).json({ message: 'Server Error during registration' });
    }
};

// --- LOGIN USER ---
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find User by Email
        // We use .select('+password') because we set select:false in the schema
        const user = await User.findOne({ email }).select('+password');

        // 2. Check if user exists AND password matches
        if (user && (await user.comparePassword(password))) {
            
            // 3. Generate Token
            const token = generateToken(user._id);

            // 4. Send Token in HTTP-Only Cookie
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });

            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during login' });
    }
};

// --- LOGOUT USER ---
const logoutUser = (req, res) => {
    // To logout, we simply clear the cookie by setting it to an empty string 
    // and expiring it immediately.
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0),
    });

    res.status(200).json({ message: 'Logged out successfully' });
};

// --- GET ME (Current User Profile) ---
const getMe = async (req, res) => {
    try {
        // req.user is set by the protect middleware
        if (!req.user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(req.user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
};