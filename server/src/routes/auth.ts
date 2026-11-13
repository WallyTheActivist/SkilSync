import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, forgotPassword, resetPassword, logout } from '../controllers/authController';
import { resendEmailVerification, verifyEmail } from '../controllers/emailVerificationController';
import { authenticate } from '../middleware/auth';
import { requiredPersonName, validateRequest } from '../middleware/validation';
import { getPasswordValidationError } from '../utils/passwordPolicy';
import { normalizeRegistrationEmail } from '../utils/registrationValidation';
import { createEmailVerificationRateLimiter } from '../config/emailVerificationRateLimit';

const router = Router();

const passwordRule = (field: string) => body(field)
	.isString()
	.withMessage('Password must be a string.')
	.bail()
	.custom((value: string) => {
		const error = getPasswordValidationError(value);
		if (error) {
			throw new Error(error);
		}
		return true;
	});

const validateInstitutionValue = (field: string, label: string) => body(field).custom((value, { req }) => {
	const role = req.body.role ?? 'STUDENT';
	if (role === 'EMPLOYER' || value === undefined) {
		return true;
	}
	if (typeof value !== 'string') {
		throw new Error(`${label} must be text.`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${label} is required.`);
	}
	if (trimmed.length > 160) {
		throw new Error(`${label} must be between 1 and 160 characters.`);
	}
	if (!/[\p{L}\p{N}]/u.test(trimmed) || /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u.test(trimmed)) {
		throw new Error(`${label} must include at least one letter or number.`);
	}
	return true;
});

const requiredCompanyValue = (field: string, label: string) => body(field).custom((value, { req }) => {
	const role = req.body.role;
	if (role !== 'EMPLOYER') {
		return true;
	}
	if (typeof value !== 'string') {
		throw new Error(`${label} must be text.`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${label} is required.`);
	}
	if (trimmed.length > 160) {
		throw new Error(`${label} must be between 1 and 160 characters.`);
	}
	if (!/[\p{L}\p{N}]/u.test(trimmed) || /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u.test(trimmed)) {
		throw new Error(`${label} must include at least one letter or number.`);
	}
	return true;
});

router.post('/register', [
	body('email').isString().withMessage('Email must be text.').bail().custom((value, { req }) => {
		const normalized = normalizeRegistrationEmail(value, req.body.role ?? 'STUDENT');
		req.body.email = normalized;
		return true;
	}),
	passwordRule('password'),
	requiredPersonName('firstName', 'First name', 80),
	requiredPersonName('lastName', 'Last name', 80),
	body('role').optional().isIn(['STUDENT', 'EMPLOYER']),
	validateInstitutionValue('university', 'University'),
	requiredCompanyValue('companyName', 'Company name'),
	validateRequest,
], register);
router.post('/verify-email', createEmailVerificationRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 10,
}), [
	body('token').isString().withMessage('Verification token is required.').bail()
		.isHexadecimal().withMessage('Invalid verification link.')
		.isLength({ min: 64, max: 64 }).withMessage('Invalid verification link.'),
	validateRequest,
], verifyEmail);
router.post('/resend-verification', createEmailVerificationRateLimiter(), [
	body('email').isString().withMessage('Email must be text.').bail().custom((value, { req }) => {
		const normalized = normalizeRegistrationEmail(value);
		req.body.email = normalized;
		return true;
	}),
	validateRequest,
], resendEmailVerification);
router.post('/login', [
	body('email').isString().trim().toLowerCase().isEmail().isLength({ max: 254 }),
	body('password').isString().isLength({ min: 1, max: 72 })
		.custom((value: string) => Buffer.byteLength(value, 'utf8') <= 72)
		.withMessage('Password must not exceed 72 UTF-8 bytes.'),
	validateRequest,
], login);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);
router.post('/forgot-password', [
	body('email').isString().trim().toLowerCase().isEmail().isLength({ max: 254 }),
	validateRequest,
], forgotPassword);
router.post('/reset-password', [
	body('token').isHexadecimal().isLength({ min: 64, max: 64 }),
	passwordRule('password'),
	validateRequest,
], resetPassword);

export default router;
