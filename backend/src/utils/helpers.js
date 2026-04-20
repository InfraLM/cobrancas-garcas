/**
 * Wraps an async route handler to catch errors automatically.
 * Uso: router.get('/', asyncHandler(myController))
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
