import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        enum: ['credentials', 'google']
    },
    providerAccountId: {
        type: String,
        required: true
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function () {
            return this.accounts.some(acc => acc.provider === 'credentials');
        }
    },
    image: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    },
  accounts: [accountSchema],
  settings: {
    maxVersions: {
      type: Number,
      default: 10,
      min: 1,
      max: 15
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ 'accounts.provider': 1, 'accounts.providerAccountId': 1 });

const User = mongoose.model('User', userSchema);

export default User;
