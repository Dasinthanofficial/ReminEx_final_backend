import { body, param, query, validationResult } from "express-validator";
import { startOfLocalDay, parseDateOnlyLocal } from "../utils/dates.js";

export const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const formatted = result.array().map((e) => ({
      field: e.path,
      message: e.msg,
      value: e.value,
    }));

    // Use the first error message as the main message
    const topMessage = formatted[0]?.message || "Validation failed";

    console.log("❌ Validation failed for", req.originalUrl);
    console.table(
      formatted.map((e) => ({
        field: e.field,
        msg: e.message,
        value: e.value,
      }))
    );

    return res.status(400).json({
      message: topMessage,
      errors: formatted,
    });
  }

  next();
};

// REGISTER
export const validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be 2–50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain a lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number"),

  validate,
];

// LOGIN
export const validateLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  validate,
];

// FORGOT PASSWORD
export const validateForgotPassword = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),
  validate,
];

// RESET PASSWORD
export const validateResetPassword = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain a lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number"),

  validate,
];

// PRODUCT CREATE
export const validateProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be 2–100 characters"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["Food", "Non-Food"])
    .withMessage('Category must be either "Food" or "Non-Food"'),

  body("expiryDate")
    .notEmpty()
    .withMessage("Expiry date is required")
    .isISO8601()
    .withMessage("Invalid date format (YYYY-MM-DD)")
    .custom((value) => {
      const expiryDate =
        /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? parseDateOnlyLocal(value)
          : new Date(value);

      const today = startOfLocalDay();
      if (expiryDate < today)
        throw new Error("Expiry date cannot be in the past");
      return true;
    }),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be positive")
    .toFloat(),

  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Weight must be positive")
    .toFloat(),

  body("image")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (req.file) return true;
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error("Image must be a valid URL");
      }
    }),

  validate,
];

// PRODUCT UPDATE
export const validateProductUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be 2–100 characters"),

  body("category")
    .optional()
    .isIn(["Food", "Non-Food"])
    .withMessage('Category must be "Food" or "Non-Food"'),

  body("expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      const expiryDate =
        /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? parseDateOnlyLocal(value)
          : new Date(value);

      const today = startOfLocalDay();
      if (expiryDate < today)
        throw new Error("Expiry date cannot be in the past");
      return true;
    }),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be positive")
    .toFloat(),

  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Weight must be positive")
    .toFloat(),

  body("image")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (req.file) return true;
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error("Image must be a valid URL");
      }
    }),

  validate,
];

// PLAN
export const validatePlan = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Plan name is required")
    .isIn(["Free", "Monthly", "Yearly"])
    .withMessage("Plan name must be Free, Monthly, or Yearly"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a number ≥ 0")
    .toFloat(),

  body("description")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be ≤ 500 characters"),

  body("features")
    .optional()
    .isArray({ max: 50 })
    .withMessage("Features must be an array (max 50)"),

  body("features.*")
    .optional()
    .isString()
    .withMessage("Each feature must be a string")
    .trim()
    .notEmpty()
    .withMessage("Feature items cannot be empty")
    .isLength({ max: 120 })
    .withMessage("Each feature must be ≤ 120 characters"),

  validate,
];

// ADVERTISEMENT
export const validateAdvertisement = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be 3–200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be ≤ 1000 characters"),

  body("link")
    .optional()
    .trim()
    .isURL()
    .withMessage("Link must be a valid URL"),

  validate,
];

// MONGO ID
export const validateMongoId = [
  param("id").isMongoId().withMessage("Invalid ID format"),
  validate,
];

// MONTH/YEAR QUERY
export const validateMonthYear = [
  query("month")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be 1-12"),

  query("year")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Year must be 2000-2100"),

  validate,
];