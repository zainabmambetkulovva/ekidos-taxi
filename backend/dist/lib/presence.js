"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketPresence = setSocketPresence;
exports.removeSocketPresence = removeSocketPresence;
exports.isDriverAppVisible = isDriverAppVisible;
/**
 * Водительдин колдонмосу азыр ЭКРАНДА АЧЫК турабы?
 * Ачык болсо заказ толук экранда чыгат; болбосо (башка колдонмодо, экран өчүк) push жиберебиз.
 */
const sockets = new Map();
function setSocketPresence(socketId, driverId, visible) {
    sockets.set(socketId, { driverId, visible });
}
function removeSocketPresence(socketId) {
    sockets.delete(socketId);
}
function isDriverAppVisible(driverId) {
    for (const s of sockets.values()) {
        if (s.driverId === driverId && s.visible)
            return true;
    }
    return false;
}
