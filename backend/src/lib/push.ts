/**
 * Push Notification Service — Expo Push API
 * TEMPORARILY DISABLED until pushToken field is added to production DB
 */

export interface OrderPushPayload {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  destAddress: string;
  price: number;
  clientName: string;
  clientPhone: string;
  type: 'new_order';
}

export async function sendPushToDriver(driverId: string, payload: OrderPushPayload): Promise<boolean> {
  // TODO: Enable after Firebase setup
  console.log(`[Push] Would send to driver ${driverId}:`, payload.orderNumber);
  return false;
}

export async function sendPushToAllOnlineDrivers(payload: OrderPushPayload): Promise<number> {
  // TODO: Enable after Firebase setup
  console.log(`[Push] Would broadcast new order:`, payload.orderNumber);
  return 0;
}
