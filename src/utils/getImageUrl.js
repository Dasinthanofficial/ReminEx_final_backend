// src/utils/getImageUrl.js
export const getImageUrl = (url) => {
  if (!url) return "";

  // Local preview (e.g., from URL.createObjectURL)
  if (url.startsWith("blob:")) return url;

  // Already full URL
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Backend-relative like "/uploads/xxx.png"
  const base =
    import.meta.env.VITE_API_URL?.replace(/\/api$/, "") ||
    "http://localhost:5000";

  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};