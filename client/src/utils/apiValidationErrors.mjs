const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getApiValidationFieldErrors = (error, fields) => {
  const response = error?.response;
  const errors = response?.data?.errors;
  if (response?.status !== 400 || !Array.isArray(errors)) return {};

  const fieldNames = [...fields].sort((left, right) => right.length - left.length);
  const fieldErrors = {};

  for (const message of errors) {
    if (typeof message !== 'string' || message.length > 300 || /stack|sql|database|prisma/i.test(message)) continue;
    const field = fieldNames.find((name) =>
      new RegExp(`(^|[^A-Za-z0-9_])${escapePattern(name)}([^A-Za-z0-9_]|$)`, 'i').test(message)
    );
    if (field && !fieldErrors[field]) fieldErrors[field] = message;
  }

  return fieldErrors;
};
