export const startOfLocalDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const parseDateOnlyLocal = (value) => {
  // expected "YYYY-MM-DD"
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
};

export const monthRangeLocal = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};