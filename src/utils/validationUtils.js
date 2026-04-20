/**
 * Validation utility functions for CSV schema validation, field edit validation,
 * and admin config validation.
 * @module validationUtils
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field - The field name that has the error
 * @property {string} message - Human-readable error message
 * @property {string} code - Machine-readable error code
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Array of validation errors
 */

/**
 * Validates CSV headers against an expected schema.
 * @param {string[]} headers - The CSV headers to validate
 * @param {Object} expectedSchema - The expected schema definition
 * @param {string[]} expectedSchema.requiredFields - Fields that must be present
 * @param {string[]} [expectedSchema.optionalFields] - Fields that may be present
 * @param {boolean} [expectedSchema.strictMode] - If true, disallow extra fields not in schema
 * @returns {ValidationResult} Structured validation result with field-level messages
 */
export function validateCSVSchema(headers, expectedSchema) {
  const errors = [];

  if (!Array.isArray(headers)) {
    errors.push({
      field: 'headers',
      message: 'Headers must be an array',
      code: 'INVALID_HEADERS_TYPE',
    });
    return { valid: false, errors };
  }

  if (!expectedSchema || typeof expectedSchema !== 'object') {
    errors.push({
      field: 'schema',
      message: 'Expected schema must be a valid object',
      code: 'INVALID_SCHEMA',
    });
    return { valid: false, errors };
  }

  const requiredFields = expectedSchema.requiredFields || [];
  const optionalFields = expectedSchema.optionalFields || [];
  const strictMode = expectedSchema.strictMode || false;

  const normalizedHeaders = headers.map((h) =>
    typeof h === 'string' ? h.trim().toLowerCase() : ''
  );

  const duplicates = normalizedHeaders.filter(
    (h, i) => h !== '' && normalizedHeaders.indexOf(h) !== i
  );
  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    uniqueDuplicates.forEach((dup) => {
      errors.push({
        field: dup,
        message: `Duplicate header found: "${dup}"`,
        code: 'DUPLICATE_HEADER',
      });
    });
  }

  requiredFields.forEach((requiredField) => {
    const normalizedRequired = requiredField.trim().toLowerCase();
    if (!normalizedHeaders.includes(normalizedRequired)) {
      errors.push({
        field: requiredField,
        message: `Missing required field: "${requiredField}"`,
        code: 'MISSING_REQUIRED_FIELD',
      });
    }
  });

  if (strictMode) {
    const allAllowedFields = [
      ...requiredFields.map((f) => f.trim().toLowerCase()),
      ...optionalFields.map((f) => f.trim().toLowerCase()),
    ];

    normalizedHeaders.forEach((header, index) => {
      if (header !== '' && !allAllowedFields.includes(header)) {
        errors.push({
          field: headers[index],
          message: `Unexpected field: "${headers[index]}" is not defined in the schema`,
          code: 'UNEXPECTED_FIELD',
        });
      }
    });
  }

  if (normalizedHeaders.length === 0) {
    errors.push({
      field: 'headers',
      message: 'CSV contains no headers',
      code: 'EMPTY_HEADERS',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a single field value against a set of rules.
 * @param {string} field - The field name being validated
 * @param {*} value - The value to validate
 * @param {Object} rules - Validation rules for the field
 * @param {boolean} [rules.required] - Whether the field is required
 * @param {string} [rules.type] - Expected type ('string', 'number', 'boolean', 'email', 'date', 'integer')
 * @param {number} [rules.minLength] - Minimum string length
 * @param {number} [rules.maxLength] - Maximum string length
 * @param {number} [rules.min] - Minimum numeric value
 * @param {number} [rules.max] - Maximum numeric value
 * @param {RegExp} [rules.pattern] - Regex pattern the value must match
 * @param {string} [rules.patternMessage] - Custom message for pattern mismatch
 * @param {Array} [rules.oneOf] - Array of allowed values
 * @param {Function} [rules.custom] - Custom validation function returning null or error string
 * @returns {ValidationResult} Structured validation result with field-level messages
 */
export function validateFieldEdit(field, value, rules) {
  const errors = [];

  if (!field || typeof field !== 'string') {
    errors.push({
      field: 'field',
      message: 'Field name must be a non-empty string',
      code: 'INVALID_FIELD_NAME',
    });
    return { valid: false, errors };
  }

  if (!rules || typeof rules !== 'object') {
    return { valid: true, errors: [] };
  }

  const isNullOrEmpty =
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

  if (rules.required && isNullOrEmpty) {
    errors.push({
      field,
      message: `"${field}" is required`,
      code: 'FIELD_REQUIRED',
    });
    return { valid: false, errors };
  }

  if (isNullOrEmpty) {
    return { valid: true, errors: [] };
  }

  if (rules.type) {
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field,
            message: `"${field}" must be a string`,
            code: 'INVALID_TYPE',
          });
        }
        break;
      case 'number':
        if (typeof value === 'string') {
          if (isNaN(Number(value))) {
            errors.push({
              field,
              message: `"${field}" must be a valid number`,
              code: 'INVALID_TYPE',
            });
          }
        } else if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field,
            message: `"${field}" must be a valid number`,
            code: 'INVALID_TYPE',
          });
        }
        break;
      case 'integer':
        {
          const numVal = typeof value === 'string' ? Number(value) : value;
          if (typeof numVal !== 'number' || isNaN(numVal) || !Number.isInteger(numVal)) {
            errors.push({
              field,
              message: `"${field}" must be a valid integer`,
              code: 'INVALID_TYPE',
            });
          }
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({
            field,
            message: `"${field}" must be a boolean`,
            code: 'INVALID_TYPE',
          });
        }
        break;
      case 'email':
        {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value !== 'string' || !emailRegex.test(value)) {
            errors.push({
              field,
              message: `"${field}" must be a valid email address`,
              code: 'INVALID_EMAIL',
            });
          }
        }
        break;
      case 'date':
        {
          const dateVal = new Date(value);
          if (isNaN(dateVal.getTime())) {
            errors.push({
              field,
              message: `"${field}" must be a valid date`,
              code: 'INVALID_DATE',
            });
          }
        }
        break;
      default:
        break;
    }
  }

  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push({
        field,
        message: `"${field}" must be at least ${rules.minLength} characters`,
        code: 'MIN_LENGTH',
      });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push({
        field,
        message: `"${field}" must be no more than ${rules.maxLength} characters`,
        code: 'MAX_LENGTH',
      });
    }
  }

  if (rules.min !== undefined || rules.max !== undefined) {
    const numericValue = typeof value === 'string' ? Number(value) : value;
    if (typeof numericValue === 'number' && !isNaN(numericValue)) {
      if (rules.min !== undefined && numericValue < rules.min) {
        errors.push({
          field,
          message: `"${field}" must be at least ${rules.min}`,
          code: 'MIN_VALUE',
        });
      }
      if (rules.max !== undefined && numericValue > rules.max) {
        errors.push({
          field,
          message: `"${field}" must be no more than ${rules.max}`,
          code: 'MAX_VALUE',
        });
      }
    }
  }

  if (rules.pattern && rules.pattern instanceof RegExp) {
    const strValue = String(value);
    if (!rules.pattern.test(strValue)) {
      errors.push({
        field,
        message: rules.patternMessage || `"${field}" does not match the required pattern`,
        code: 'PATTERN_MISMATCH',
      });
    }
  }

  if (rules.oneOf && Array.isArray(rules.oneOf)) {
    if (!rules.oneOf.includes(value)) {
      errors.push({
        field,
        message: `"${field}" must be one of: ${rules.oneOf.join(', ')}`,
        code: 'NOT_IN_ALLOWED_VALUES',
      });
    }
  }

  if (typeof rules.custom === 'function') {
    try {
      const customError = rules.custom(value);
      if (customError && typeof customError === 'string') {
        errors.push({
          field,
          message: customError,
          code: 'CUSTOM_VALIDATION',
        });
      }
    } catch (err) {
      errors.push({
        field,
        message: `Custom validation error for "${field}": ${err.message || 'Unknown error'}`,
        code: 'CUSTOM_VALIDATION_ERROR',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an admin configuration object.
 * @param {Object} config - The admin configuration to validate
 * @param {string} [config.dashboardTitle] - Title for the dashboard
 * @param {number} [config.refreshInterval] - Data refresh interval in seconds
 * @param {number} [config.maxUsersPerPage] - Maximum users displayed per page
 * @param {string} [config.dateFormat] - Date format string
 * @param {string} [config.theme] - UI theme ('light', 'dark', 'system')
 * @param {Object} [config.notifications] - Notification settings
 * @param {boolean} [config.notifications.emailEnabled] - Whether email notifications are enabled
 * @param {boolean} [config.notifications.smsEnabled] - Whether SMS notifications are enabled
 * @param {string[]} [config.notifications.recipients] - Notification recipient emails
 * @param {Object} [config.dataRetention] - Data retention settings
 * @param {number} [config.dataRetention.days] - Number of days to retain data
 * @param {boolean} [config.dataRetention.archiveEnabled] - Whether archiving is enabled
 * @returns {ValidationResult} Structured validation result with field-level messages
 */
export function validateAdminConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push({
      field: 'config',
      message: 'Configuration must be a valid object',
      code: 'INVALID_CONFIG',
    });
    return { valid: false, errors };
  }

  if (config.dashboardTitle !== undefined) {
    if (typeof config.dashboardTitle !== 'string') {
      errors.push({
        field: 'dashboardTitle',
        message: 'Dashboard title must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (config.dashboardTitle.trim().length === 0) {
      errors.push({
        field: 'dashboardTitle',
        message: 'Dashboard title cannot be empty',
        code: 'FIELD_REQUIRED',
      });
    } else if (config.dashboardTitle.length > 200) {
      errors.push({
        field: 'dashboardTitle',
        message: 'Dashboard title must be no more than 200 characters',
        code: 'MAX_LENGTH',
      });
    }
  }

  if (config.refreshInterval !== undefined) {
    if (typeof config.refreshInterval !== 'number' || isNaN(config.refreshInterval)) {
      errors.push({
        field: 'refreshInterval',
        message: 'Refresh interval must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (!Number.isInteger(config.refreshInterval)) {
      errors.push({
        field: 'refreshInterval',
        message: 'Refresh interval must be an integer',
        code: 'INVALID_TYPE',
      });
    } else if (config.refreshInterval < 5) {
      errors.push({
        field: 'refreshInterval',
        message: 'Refresh interval must be at least 5 seconds',
        code: 'MIN_VALUE',
      });
    } else if (config.refreshInterval > 3600) {
      errors.push({
        field: 'refreshInterval',
        message: 'Refresh interval must be no more than 3600 seconds',
        code: 'MAX_VALUE',
      });
    }
  }

  if (config.maxUsersPerPage !== undefined) {
    if (typeof config.maxUsersPerPage !== 'number' || isNaN(config.maxUsersPerPage)) {
      errors.push({
        field: 'maxUsersPerPage',
        message: 'Max users per page must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (!Number.isInteger(config.maxUsersPerPage)) {
      errors.push({
        field: 'maxUsersPerPage',
        message: 'Max users per page must be an integer',
        code: 'INVALID_TYPE',
      });
    } else if (config.maxUsersPerPage < 1) {
      errors.push({
        field: 'maxUsersPerPage',
        message: 'Max users per page must be at least 1',
        code: 'MIN_VALUE',
      });
    } else if (config.maxUsersPerPage > 500) {
      errors.push({
        field: 'maxUsersPerPage',
        message: 'Max users per page must be no more than 500',
        code: 'MAX_VALUE',
      });
    }
  }

  if (config.dateFormat !== undefined) {
    if (typeof config.dateFormat !== 'string') {
      errors.push({
        field: 'dateFormat',
        message: 'Date format must be a string',
        code: 'INVALID_TYPE',
      });
    } else {
      const allowedFormats = [
        'MM/DD/YYYY',
        'DD/MM/YYYY',
        'YYYY-MM-DD',
        'MM-DD-YYYY',
        'DD-MM-YYYY',
        'YYYY/MM/DD',
      ];
      if (!allowedFormats.includes(config.dateFormat)) {
        errors.push({
          field: 'dateFormat',
          message: `Date format must be one of: ${allowedFormats.join(', ')}`,
          code: 'NOT_IN_ALLOWED_VALUES',
        });
      }
    }
  }

  if (config.theme !== undefined) {
    const allowedThemes = ['light', 'dark', 'system'];
    if (typeof config.theme !== 'string' || !allowedThemes.includes(config.theme)) {
      errors.push({
        field: 'theme',
        message: `Theme must be one of: ${allowedThemes.join(', ')}`,
        code: 'NOT_IN_ALLOWED_VALUES',
      });
    }
  }

  if (config.notifications !== undefined) {
    if (typeof config.notifications !== 'object' || Array.isArray(config.notifications) || config.notifications === null) {
      errors.push({
        field: 'notifications',
        message: 'Notifications must be a valid object',
        code: 'INVALID_TYPE',
      });
    } else {
      if (
        config.notifications.emailEnabled !== undefined &&
        typeof config.notifications.emailEnabled !== 'boolean'
      ) {
        errors.push({
          field: 'notifications.emailEnabled',
          message: 'Email enabled must be a boolean',
          code: 'INVALID_TYPE',
        });
      }

      if (
        config.notifications.smsEnabled !== undefined &&
        typeof config.notifications.smsEnabled !== 'boolean'
      ) {
        errors.push({
          field: 'notifications.smsEnabled',
          message: 'SMS enabled must be a boolean',
          code: 'INVALID_TYPE',
        });
      }

      if (config.notifications.recipients !== undefined) {
        if (!Array.isArray(config.notifications.recipients)) {
          errors.push({
            field: 'notifications.recipients',
            message: 'Recipients must be an array',
            code: 'INVALID_TYPE',
          });
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          config.notifications.recipients.forEach((recipient, index) => {
            if (typeof recipient !== 'string' || !emailRegex.test(recipient)) {
              errors.push({
                field: `notifications.recipients[${index}]`,
                message: `Recipient at index ${index} must be a valid email address`,
                code: 'INVALID_EMAIL',
              });
            }
          });
        }
      }
    }
  }

  if (config.dataRetention !== undefined) {
    if (typeof config.dataRetention !== 'object' || Array.isArray(config.dataRetention) || config.dataRetention === null) {
      errors.push({
        field: 'dataRetention',
        message: 'Data retention must be a valid object',
        code: 'INVALID_TYPE',
      });
    } else {
      if (config.dataRetention.days !== undefined) {
        if (typeof config.dataRetention.days !== 'number' || isNaN(config.dataRetention.days)) {
          errors.push({
            field: 'dataRetention.days',
            message: 'Retention days must be a number',
            code: 'INVALID_TYPE',
          });
        } else if (!Number.isInteger(config.dataRetention.days)) {
          errors.push({
            field: 'dataRetention.days',
            message: 'Retention days must be an integer',
            code: 'INVALID_TYPE',
          });
        } else if (config.dataRetention.days < 1) {
          errors.push({
            field: 'dataRetention.days',
            message: 'Retention days must be at least 1',
            code: 'MIN_VALUE',
          });
        } else if (config.dataRetention.days > 3650) {
          errors.push({
            field: 'dataRetention.days',
            message: 'Retention days must be no more than 3650',
            code: 'MAX_VALUE',
          });
        }
      }

      if (
        config.dataRetention.archiveEnabled !== undefined &&
        typeof config.dataRetention.archiveEnabled !== 'boolean'
      ) {
        errors.push({
          field: 'dataRetention.archiveEnabled',
          message: 'Archive enabled must be a boolean',
          code: 'INVALID_TYPE',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a data object against a schema definition with field-level rules.
 * @param {Object} data - The data object to validate
 * @param {Object} schema - Schema definition where keys are field names and values are rule objects
 * @param {boolean} [schema[field].required] - Whether the field is required
 * @param {string} [schema[field].type] - Expected type
 * @param {number} [schema[field].minLength] - Minimum string length
 * @param {number} [schema[field].maxLength] - Maximum string length
 * @param {number} [schema[field].min] - Minimum numeric value
 * @param {number} [schema[field].max] - Maximum numeric value
 * @param {RegExp} [schema[field].pattern] - Regex pattern
 * @param {Array} [schema[field].oneOf] - Allowed values
 * @param {Function} [schema[field].custom] - Custom validation function
 * @returns {ValidationResult} Structured validation result with field-level messages
 */
export function getValidationErrors(data, schema) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push({
      field: 'data',
      message: 'Data must be a valid object',
      code: 'INVALID_DATA',
    });
    return { valid: false, errors };
  }

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    errors.push({
      field: 'schema',
      message: 'Schema must be a valid object',
      code: 'INVALID_SCHEMA',
    });
    return { valid: false, errors };
  }

  const schemaKeys = Object.keys(schema);

  for (const fieldName of schemaKeys) {
    const rules = schema[fieldName];
    if (!rules || typeof rules !== 'object') {
      continue;
    }

    const value = data[fieldName];
    const result = validateFieldEdit(fieldName, value, rules);

    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}