export const adminOnly = (req, res, next) => {
  // req.user is set by authMiddleware
  if (req.user && req.user.role === "admin") {
    next(); // allow access
  } else {
    res.status(403).json({ message: "Access denied: Admins only" });
  }
};

