import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendOTPEmail, sendWelcomeEmail } from '../utils/emailService.js';

// Helper function to generate JWT
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res) => {
    const token = signToken(user._id);

    // Cookie options
    const cookieOptions = {
        expires: new Date(
            Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
        ),
        httpOnly: true, // Prevents XSS attacks
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax'
    };

    // Send cookie
    res.cookie('jwt', token, cookieOptions);

    res.status(statusCode).json({
        success: true,
        token,
        data: {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                image: user.image,
                isVerified: user.isVerified
            }
        }
    });
};



// Generate 4-digit OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// Hash password
const hashPassword = async (password) => {
    return bcrypt.hash(password, 12);
};

// Compare password
const comparePassword = async (candidatePassword, userPassword) => {
    return bcrypt.compare(candidatePassword, userPassword);
};




// @desc    Sign up with email and password
// @route   POST /api/v1/adobe-ps/auth/signup
// @access  Public
export const signup = catchAsync(async (req, res, next) => {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
        return next(new AppError('Please provide name, email and password', 400));
    }

    if (password.length < 6) {
        return next(new AppError('Password must be at least 6 characters', 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        return next(new AppError('User with this email already exists', 400));
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with account
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        otp,
        otpExpiry,
        isVerified: false, // Normal users need OTP verification
        accounts: [{
            provider: 'credentials',
            providerAccountId: email
        }]
    });

    // Send OTP via email (or console log in development)
    if (process.env.NODE_ENV === 'development') {
        console.log('\n=================================');
        console.log('🔐 DEVELOPMENT MODE - OTP');
        console.log('=================================');
        console.log(`Email: ${email}`);
        console.log(`Name: ${name}`);
        console.log(`OTP: ${otp}`);
        console.log(`Expires: ${otpExpiry.toLocaleString()}`);
        console.log('=================================\n');
    } else {
        await sendOTPEmail(email, otp, name);
        console.log(`OTP email sent to ${email}`);
    }

    res.status(201).json({
        success: true,
        message: 'User created successfully. Please check your email for the OTP.',
        data: {
            userId: user._id,
            email: user.email,
            name: user.name,
            // In development, send OTP in response. Remove in production!
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        }
    });
});

// @desc    Verify OTP
// @route   POST /api/v1/adobe-ps/auth/verify-otp
// @access  Public
export const verifyOTP = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return next(new AppError('Please provide email and OTP', 400));
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    if (user.isVerified) {
        return next(new AppError('User is already verified', 400));
    }

    // Check if OTP is expired
    if (!user.otpExpiry || new Date() > user.otpExpiry) {
        return next(new AppError('OTP has expired. Please request a new one.', 400));
    }

    // Verify OTP
    if (user.otp !== otp) {
        return next(new AppError('Invalid OTP', 400));
    }

    // Update user as verified and clear OTP
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Send welcome email (don't fail if this errors)
    sendWelcomeEmail(email, user.name).catch(err => 
        console.error('Failed to send welcome email:', err)
    );

    res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now login.',
        data: {
            userId: user._id,
            email: user.email,
            isVerified: user.isVerified
        }
    });
});

// @desc    Resend OTP
// @route   POST /api/v1/adobe-ps/auth/resend-otp
// @access  Public
export const resendOTP = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Please provide email', 400));
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    if (user.isVerified) {
        return next(new AppError('User is already verified', 400));
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP via email (or console log in development)
    if (process.env.NODE_ENV === 'development') {
        console.log('\n=================================');
        console.log('🔐 DEVELOPMENT MODE - RESEND OTP');
        console.log('=================================');
        console.log(`Email: ${email}`);
        console.log(`Name: ${user.name}`);
        console.log(`OTP: ${otp}`);
        console.log(`Expires: ${otpExpiry.toLocaleString()}`);
        console.log('=================================\n');
    } else {
        await sendOTPEmail(email, otp, user.name);
        console.log(`New OTP email sent to ${email}`);
    }

    res.status(200).json({
        success: true,
        message: 'OTP sent successfully to your email',
        data: {
            // In development, send OTP in response. Remove in production!
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        }
    });
});



// @desc    Login with email and password
// @route   POST /api/v1/adobe-ps/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    // Find user with credentials account
    const user = await User.findOne({
        email,
        'accounts.provider': 'credentials'
    });

    if (!user) {
        return next(new AppError('Invalid email or password', 401));
    }

    // Check if user is verified
    if (!user.isVerified) {
        return next(new AppError('Please verify your email before logging in', 401));
    }

    // Check password
    const isPasswordCorrect = await comparePassword(password, user.password);

    if (!isPasswordCorrect) {
        return next(new AppError('Invalid email or password', 401));
    }

    // Send token response
    sendTokenResponse(user, 200, res);
});


// @desc    Logout user
// @route   GET /api/v1/adobe-ps/auth/logout
// @access  Private
export const logout = (req, res) => {
    // Clear the JWT cookie
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};