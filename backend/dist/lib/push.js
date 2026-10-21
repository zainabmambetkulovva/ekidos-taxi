"use strict";
/**
 * Push Notification Service — Expo Push API
 * TEMPORARILY DISABLED until pushToken field is added to production DB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToDriver = sendPushToDriver;
exports.sendPushToAllOnlineDrivers = sendPushToAllOnlineDrivers;
async function sendPushToDriver(driverId, payload) {
    // TODO: Enable after Firebase setup
    console.log(`[Push] Would send to driver ${driverId}:`, payload.orderNumber);
    return false;
}
async function sendPushToAllOnlineDrivers(payload) {
    // TODO: Enable after Firebase setup
    console.log(`[Push] Would broadcast new order:`, payload.orderNumber);
    return 0;
}
