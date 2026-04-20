import PropTypes from 'prop-types';

export function LoadingSpinner({ message, size = 'md' }) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-gray-300 border-t-blue-600`}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

LoadingSpinner.propTypes = {
  message: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};