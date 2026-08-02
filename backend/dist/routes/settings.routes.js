"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get settings
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        let settings = await server_1.prisma.settings.findFirst();
        if (!settings) {
            settings = await server_1.prisma.settings.create({ data: {} });
        }
        return res.json(settings);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Update settings
router.put('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { companyName, companyLogo, theme, language, currency } = req.body;
        let settings = await server_1.prisma.settings.findFirst();
        if (!settings) {
            settings = await server_1.prisma.settings.create({
                data: { companyName, companyLogo, theme, language, currency },
            });
        }
        else {
            settings = await server_1.prisma.settings.update({
                where: { id: settings.id },
                data: { companyName, companyLogo, theme, language, currency },
            });
        }
        return res.json(settings);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
