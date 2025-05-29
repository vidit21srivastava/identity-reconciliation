import { Request, Response, NextFunction } from 'express';

export const validateIdentifyRequest = (req: Request, res: Response, next: NextFunction) => {
    const { email, phoneNumber } = req.body;

    // At least one of email or phoneNumber should be provided
    if (!email && !phoneNumber) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'At least one of email or phoneNumber must be provided'
        });
    }

    // Validate email format if provided
    if (email && typeof email !== 'string') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Email must be a string'
        });
    }

    if (email && email.trim() === '') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Email cannot be empty'
        });
    }

    // Basic email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid email format'
        });
    }

    // Validate phoneNumber format if provided
    if (phoneNumber && typeof phoneNumber !== 'string') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Phone number must be a string'
        });
    }

    if (phoneNumber && phoneNumber.trim() === '') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Phone number cannot be empty'
        });
    }

    next();
};