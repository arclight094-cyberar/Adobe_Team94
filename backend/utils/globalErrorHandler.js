import AppError from "./AppError.js";


// Handle invalid MongoDB ObjectId
const handleCastErrorDB = (err) => {
  let message = `Invalid ${err.path}: ${err.value}.`;
  
  // Specific messages for different resources
  if (err.path === '_id') {
    if (err.value && err.value.length === 24) {
      message = 'Resource not found with the provided ID.';
    } else {
      message = 'Invalid ID format. Please provide a valid ID.';
    }
  }
  
  return new AppError(message, 400);
};


// Handle duplicate email or unique fields
const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? JSON.stringify(err.keyValue) : '';
  let message = `Duplicate field value: ${value}. Please use another value!`;
  
  // Specific messages for known duplicates
  if (err.keyValue?.email) {
    message = 'This email is already registered. Please use another email or log in.';
  } else if (err.keyValue?.publicId) {
    message = 'This image already exists in the system.';
  }
  
  return new AppError(message, 400);
};


// Handle validation errors (schema rules)
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  
  // Provide clearer messages for common validation errors
  const errorMessages = errors.map(msg => {
    // Clean up mongoose default messages
    if (msg.includes('Path') && msg.includes('is required')) {
      const field = msg.match(/Path `(.+?)`/)?.[1];
      return `${field} is required`;
    }
    return msg;
  });
  
  const message = `Invalid input data. ${errorMessages.join('. ')}`;
  return new AppError(message, 400);
};


// Handle JWT invalid token error
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};


// Handle JWT expired token error
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};


// Handle Cloudinary errors
const handleCloudinaryError = (err) => {
  const message = 'Failed to process image. Please try again or use a different image.';
  return new AppError(message, 500);
};


// Handle Multer file upload errors
const handleMulterError = (err) => {
  let message = 'File upload error.';
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File size is too large. Maximum size is 20MB.';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    message = 'Too many files. Maximum is 10 files at once.';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Unexpected file field. Please check your upload format.';
  }
  
  return new AppError(message, 400);
};


// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};


// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or unknown error: don't leak error details
    console.error('❌ ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};


// Main Global error middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if ((process.env.NODE_ENV || '').trim() === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message, name: err.name };

    // MongoDB errors
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    // Multer errors
    if (err.name === 'MulterError') error = handleMulterError(error);
    
    // Cloudinary errors
    if (err.message && err.message.includes('cloudinary')) error = handleCloudinaryError(error);

    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;
