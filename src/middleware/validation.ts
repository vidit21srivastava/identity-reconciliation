import { Request, Response, NextFunction, RequestHandler } from 'express';

export const validateIdentifyRequest: RequestHandler =
    (req: Request, res: Response, next: NextFunction): void => {

        const { email, phoneNumber } = req.body;

        // At least one of email or phoneNumber should be provided
        if (!email && !phoneNumber) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'At least one of email or phoneNumber must be provided'
            });
            return;
        }

        // Validate email format if provided
        if (email && typeof email !== 'string') {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Email must be a string'
            });
            return;
        }

        if (email && email.trim() === '') {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Email cannot be empty'
            });
            return;
        }

        // Basic email validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid email format'
            });
            return;
        }

        // Validate phoneNumber format if provided
        if (phoneNumber && typeof phoneNumber !== 'string') {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Phone number must be a string'
            });
            return;
        }

        if (phoneNumber && phoneNumber.trim() === '') {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Phone number cannot be empty'
            });
            return;
        }

        next();
    };