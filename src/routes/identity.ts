import express from 'express';
import { IdentityService, IdentifyRequest } from '../services/identityService';
import { validateIdentifyRequest } from '../middleware/validation';

const router = express.Router();
const identityService = new IdentityService();

router.post('/', validateIdentifyRequest, async (req, res, next) => {
    try {
        const request: IdentifyRequest = req.body;
        const result = await identityService.identify(request);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

export default router;