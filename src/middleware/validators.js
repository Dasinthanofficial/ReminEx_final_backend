import { body, param, query, validationResult } from 'express-validator';


export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: "Validation failed",
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// ========== AUTHENTICATION VALIDATORS ==========

export const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  
  validate
];

export const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  validate
];

export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  validate
];

export const validateResetPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  
  validate
];

// ========== PRODUCT VALIDATORS ==========

export const validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Product name must be 2-100 characters'),
  
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['Food', 'Non-Food']).withMessage('Category must be either "Food" or "Non-Food"'),
  
  body('expiryDate')
    .notEmpty().withMessage('Expiry date is required')
    .isISO8601().withMessage('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      const expiryDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        throw new Error('Expiry date cannot be in the past');
      }
      return true;
    }),
  
  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  
  body('weight')
    .optional()
    .isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  
  body('image')
    .optional()
    .trim()
    .isURL().withMessage('Image must be a valid URL'),
  
  validate
];

export const validateProductUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Product name must be 2-100 characters'),
  
  body('category')
    .optional()
    .isIn(['Food', 'Non-Food']).withMessage('Category must be either "Food" or "Non-Food"'),
  
  body('expiryDate')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  
  body('weight')
    .optional()
    .isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  
  validate
];

// ========== PLAN VALIDATORS ==========

export const validatePlan = [
  body('name')
    .trim()
    .notEmpty().withMessage('Plan name is required')
    .isIn(['Free', 'Monthly', 'Yearly']).withMessage('Plan name must be Free, Monthly, or Yearly'),
  
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  
  body('features')
    .optional()
    .isArray().withMessage('Features must be an array'),
  
  validate
];

// ========== ADVERTISEMENT VALIDATORS ==========

export const validateAdvertisement = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  
  body('link')
    .optional()
    .trim()
    .isURL().withMessage('Link must be a valid URL'),
  
  validate
];

// ========== GENERAL VALIDATORS ==========

export const validateMongoId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  
  validate
];

export const validateMonthYear = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
  
  validate
];