/**
 * Push Notification Service — Expo Push API
 * 
 * Sends DATA-ONLY messages with HIGH priority.
 * Works with both Expo Push Tokens (ExponentPushToken[xxx]) and raw FCM tokens.
 * 
 * Data-only messages wake up the app even when KILLED/BACKGROUND
 * because Android treats them differently from notification messages.
 */

import axios from 'axios';
import { prisma } from '../server';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

/**
 * Send push notification to a specific driver
 */
export async function sendPushToDriver(driverId: string, payload: OrderPushPayload): Promise<boolean> {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { pushToken: true, firstName: true },
    });

    if (!driver?.pushToken) {
      console.log(`⚠️ Driver ${driverId} has no push token`);
      return false;
    }

    return await sendExpoPush(driver.pushToken, payload);
  } catch (error) {
    console.error('Push to driver error:', error);
    return false;
  }
}

/**
 * Send push notification to ALL online drivers
 */
export async function sendPushToAllOnlineDrivers(payload: OrderPushPayload): Promise<number> {
  try {
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        pushToken: { not: null },
        accountStatus: 'ACTIVE',
      },
      select: { id: true, pushToken: true },
    });

    if (drivers.length === 0) {
      console.log('⚠️ No online drivers with push tokens');
      return 0;
    }

    const tokens = drivers
      .map(d => d.pushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) return 0;

    // Send in batches of 100 (Expo limit)
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const results = await sendExpoPushBatch(batch, payload);
      sent += results;
    }

    console.log(`📨 Push sent to ${sent}/${tokens.length} drivers`);
    return sent;
  } catch (error) {
    console.error('Push to all drivers error:', error);
    return 0;
  }
}

/**
 * Send a single Expo push notification
 * Uses DATA-ONLY format with channelId for Android high priority
 */
async function sendExpoPush(token: string, payload: OrderPushPayload): Promise<boolean> {
  try {
    const message = buildPushMessage(token, payload);
    
    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    if (response.data?.data?.status === 'ok') {
      return true;
    }

    // Handle token errors (invalidated tokens)
    if (response.data?.data?.details?.error === 'DeviceNotRegistered') {
      // Remove invalid token
      await prisma.driver.updateMany({
        where: { pushToken: token },
        data: { pushToken: null },
      });
      console.log(`🗑️ Removed invalid push token`);
    }

    return false;
  } catch (error) {
    console.error('Expo push send error:', error);
    return false;
  }
}

/**
 * Send batch of Expo push notifications
 */
async function sendExpoPushBatch(tokens: string[], payload: OrderPushPayload): Promise<number> {
  try {
    const messages = tokens.map(token => buildPushMessage(token, payload));

    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    const results = response.data?.data || [];
    let successCount = 0;

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'ok') {
        successCount++;
      } else if (results[i].details?.error === 'DeviceNotRegistered') {
        // Clean up invalid token
        await prisma.driver.updateMany({
          where: { pushToken: tokens[i] },
          data: { pushToken: null },
        });
      }
    }

    return successCount;
  } catch (error) {
    console.error('Expo push batch error:', error);
    return 0;
  }
}

/**
 * Build the push message object
 * 
 * KEY DESIGN DECISIONS:
 * - Uses 'data' field for payload (DATA-ONLY message behavior)
 * - Sets priority to 'high' (wakes device from Doze mode)
 * - Sets channelId to 'orders' (MAX importance Android channel)
 * - title/body are set for the notification display
 * - Android-specific: sets priority to 'max'
 */
function buildPushMessage(token: string, payload: OrderPushPayload) {
  return {
    to: token,
    
    // Notification display (shown by OS)
    title: '🚖 Жаңы заказ!',
    body: `${payload.pickupAddress} → ${payload.destAddress} | ${payload.price} сом`,
    subtitle: payload.clientName,
    
    // DATA payload (received by app even in background/killed)
    data: {
      ...payload,
      timestamp: Date.now().toString(),
    },

    // HIGH PRIORITY — wakes device
    priority: 'high',
    
    // Android specific
    channelId: 'orders',
    
    // Sound
    sound: 'order-alert.wav',
    
    // Badge
    badge: 1,
    
    // TTL — message expires after 60 seconds (order might be taken)
    ttl: 60,

    // Category for action buttons (iOS)
    categoryId: 'new_order',
  };
}
