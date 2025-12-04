import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const client = new OAuth2Client(process.env.Google_client_id);

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
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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



// @desc    Google Sign In/Sign Up
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = catchAsync(async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) {
        return next(new AppError('Please provide Google ID token', 400));
    }

    // Verify the ID token
    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.Google_client_id
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
        return next(new AppError('Unable to get email from Google', 400));
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
        // User exists - check if they have Google account linked
        const hasGoogleAccount = user.accounts.some(
            acc => acc.provider === 'google'
        );

        if (!hasGoogleAccount) {
            // User signed up with credentials, trying to login with Google
            return next(new AppError('An account with this email already exists. Please login with your email and password.', 400));
        }
        
        // User has Google account - proceed with login
    } else {
        // New user - create account with Google
        user = await User.create({
            name,
            email,
            password: null, // No password for Google users
            image: picture,
            isVerified: true, // Google users are auto-verified
            accounts: [{
                provider: 'google',
                providerAccountId: googleId
            }]
        });
    }

    // Send token response
    sendTokenResponse(user, 200, res);
});
