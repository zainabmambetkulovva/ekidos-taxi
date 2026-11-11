/**
 * Водительдин колдонмосу азыр ЭКРАНДА АЧЫК турабы?
 * Ачык болсо заказ толук экранда чыгат; болбосо (башка колдонмодо, экран өчүк) push жиберебиз.
 */
const sockets = new Map<string, { driverId: string; visible: boolean }>();

export function setSocketPresence(socketId: string, driverId: string, visible: boolean) {
  sockets.set(socketId, { driverId, visible });
}

export function removeSocketPresence(socketId: string) {
  sockets.delete(socketId);
}

export function isDriverAppVisible(driverId: string): boolean {
  for (const s of sockets.values()) {
    if (s.driverId === driverId && s.visible) return true;
  }
  return false;
}
