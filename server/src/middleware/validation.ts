import { NextFunction, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';

const HAS_LETTER = /\p{L}/u;
const MEANINGLESS_TEXT = /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u;
const UNIVERSITY_CONTENT_PATTERN = /[\p{L}\p{N}]/u;

const isMeaningfulName = (value: string): boolean => Boolean(value) && HAS_LETTER.test(value) && !MEANINGLESS_TEXT.test(value);

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req).array({ onlyFirstError: true });
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid request data.',
      errors: errors.map(({ msg }) => msg),
    });
    return;
  }
  next();
};

export const requiredText = (field: string, maxLength: number) =>
  body(field)
    .isString().withMessage(`${field} must be a string.`).bail()
    .trim()
    .isLength({ min: 1, max: maxLength }).withMessage(`${field} must be between 1 and ${maxLength} characters.`);

export const requiredPersonName = (field: string, label: string, maxLength: number) =>
  body(field)
    .isString().withMessage(`${label} must be text.`).bail()
    .trim()
    .custom((value: string) => typeof value === 'string' && value.length >= 1 && value.length <= maxLength && isMeaningfulName(value))
    .withMessage(`${label} must be between 1 and ${maxLength} characters and include at least one letter.`);

export const optionalPersonName = (field: string, label: string, maxLength: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage(`${label} must be text.`).bail()
    .trim()
    .custom((value: string) => typeof value === 'string' && value.length >= 1 && value.length <= maxLength && isMeaningfulName(value))
    .withMessage(`${label} must be between 1 and ${maxLength} characters and include at least one letter.`);

export const optionalInstitutionName = (field: string, maxLength: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage('University must be text.').bail()
    .trim()
    .custom((value: string) => typeof value === 'string' && value.length >= 1 && value.length <= maxLength && UNIVERSITY_CONTENT_PATTERN.test(value) && !MEANINGLESS_TEXT.test(value))
    .withMessage('University must be between 1 and 160 characters and include at least one letter or number.');

export const optionalText = (field: string, maxLength: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage(`${field} must be a string.`).bail()
    .trim()
    .isLength({ max: maxLength }).withMessage(`${field} must be at most ${maxLength} characters.`);

export const optionalRequiredText = (field: string, maxLength: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage(`${field} must be a string.`).bail()
    .trim()
    .isLength({ min: 1, max: maxLength }).withMessage(`${field} must be between 1 and ${maxLength} characters.`);

export const optionalHttpUrl = (field: string) =>
  body(field)
    .optional({ values: 'null' })
    .custom((value) => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
      } catch {
        return false;
      }
    })
    .withMessage(`${field} must be an HTTP or HTTPS URL.`);

export const optionalNumber = (
  field: string,
  minimum: number,
  maximum: number,
  integer = false,
  allowNull = false,
) =>
  body(field)
    .optional(allowNull ? { values: 'null' } : undefined)
    .custom((value) => typeof value === 'number'
      && Number.isFinite(value)
      && value >= minimum
      && value <= maximum
      && (!integer || Number.isInteger(value)))
    .withMessage(`${field} must be a ${integer ? 'whole number' : 'number'} between ${minimum} and ${maximum}.`);

export const requiredNumber = (
  field: string,
  minimum: number,
  maximum: number,
  integer = false
) =>
  body(field)
    .custom((value) => typeof value === 'number'
      && Number.isFinite(value)
      && value >= minimum
      && value <= maximum
      && (!integer || Number.isInteger(value)))
    .withMessage(`${field} must be a ${integer ? 'whole number' : 'number'} between ${minimum} and ${maximum}.`);

export const optionalBoolean = (field: string) =>
  body(field)
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage(`${field} must be a boolean.`);

export const optionalEnum = (field: string, allowedValues: readonly string[]) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage(`${field} must be a string.`).bail()
    .isIn([...allowedValues]).withMessage(`${field} must be one of: ${allowedValues.join(', ')}.`);

export const idParam = (field = 'id') =>
  param(field)
    .isString().withMessage(`${field} must be a string.`).bail()
    .isLength({ min: 1, max: 128 }).withMessage(`${field} is invalid.`);

export const optionalPagination = () => [
  query('page').optional().custom((value) => typeof value === 'string' && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100_000).withMessage('page must be an integer between 1 and 100000.'),
  query('limit').optional().custom((value) => typeof value === 'string' && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100).withMessage('limit must be an integer between 1 and 100.'),
];

export const optionalIsoDate = (field: string) =>
  body(field)
    .optional({ values: 'null' })
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage(`${field} must be a valid ISO 8601 date.`);

export const optionalQueryText = (field: string, maxLength: number) =>
  query(field)
    .optional()
    .custom((value) => typeof value === 'string')
    .withMessage(`${field} must be a string.`)
    .bail()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`${field} must be at most ${maxLength} characters.`);

export const optionalQueryEnum = (field: string, allowedValues: readonly string[]) =>
  query(field)
    .optional()
    .custom((value) => typeof value === 'string' && allowedValues.includes(value))
    .withMessage(`${field} must be one of: ${allowedValues.join(', ')}.`);