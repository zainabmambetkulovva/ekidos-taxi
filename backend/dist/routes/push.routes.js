"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const webpush_1 = require("../lib/webpush");
const router = (0, express_1.Router)();
// Браузер жазылуу үчүн ачык ачкыч
router.get('/public-key', async (_req, res) => {
    try {
        const key = await (0, webpush_1.getVapidPublicKey)();
        if (!key)
            return res.status(503).json({ error: 'Push is not available' });
        return res.json({ publicKey: key });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Водительдин телефонун жазуу
router.post('/subscribe', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'DRIVER')
            return res.status(403).json({ error: 'Водитель гана' });
        const ok = await (0, webpush_1.saveSubscription)(req.user.id, req.body?.subscription, req.body?.lang);
        if (!ok)
            return res.status(400).json({ error: 'Invalid subscription' });
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Push subscribe error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Жазылууну өчүрүү (аккаунттан чыкканда)
router.post('/unsubscribe', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        await (0, webpush_1.removeSubscription)(req.body?.endpoint, req.user?.role === 'DRIVER' ? req.user.id : undefined);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
