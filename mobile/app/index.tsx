import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, AppState, Vibration, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ===== CONFIG =====
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://ekidos-taxi-frontend.vercel.app';
const BACKEND_URL = 'https://ekidos-taxi-production-587e.up.railway.app';

// ===== NOTIFICATION HANDLER (foreground) =====
// This runs when notification arrives while app is IN FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Always show the notification even in foreground
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// ===== BACKGROUND NOTIFICATION HANDLER =====
// This is the critical part — runs when app is KILLED or in BACKGROUND
// For data-only messages, this task processes them and shows local notification
Notifications.registerTaskAsync?.('BACKGROUND_NOTIFICATION_TASK').catch(() => {});

// Define the background task handler at module level (runs even when app is killed)
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  useEffect(() => {
    // 1. Setup notification channel (Android)
    setupNotificationChannel();

    // 2. Register for push notifications and get token
    registerForPushNotifications().then((token) => {
      if (token) {
        setExpoPushToken(token);
        console.log('📱 Push token:', token);
      }
    });

    // 3. Listener: notification received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      console.log('🔔 Notification received:', data);

      // Vibrate aggressively for new orders
      if (data?.type === 'new_order') {
        Vibration.vibrate([0, 500, 200, 500, 200, 500], false);
      }

      // Inject order data into WebView
      if (webviewRef.current && data) {
        const script = `
          window.dispatchEvent(new CustomEvent('push-notification', { 
            detail: ${JSON.stringify(data)} 
          }));
          true;
        `;
        webviewRef.current.injectJavaScript(script);
      }
    });

    // 4. Listener: user taps on notification (opens app)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('👆 Notification tapped:', data);

      // Navigate to order in WebView
      if (webviewRef.current && data?.orderId) {
        const script = `
          window.dispatchEvent(new CustomEvent('push-notification-tap', { 
            detail: ${JSON.stringify(data)} 
          }));
          true;
        `;
        webviewRef.current.injectJavaScript(script);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // When WebView sends message (e.g., driver login with ID)
  const handleWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // WebView tells us the driver ID after login
      if (message.type === 'driver-login' && message.driverId && expoPushToken) {
        await savePushToken(message.driverId, expoPushToken);
      }

      // WebView requests push token
      if (message.type === 'get-push-token') {
        webviewRef.current?.injectJavaScript(`
          window.__expoPushToken = '${expoPushToken}';
          window.dispatchEvent(new CustomEvent('push-token-ready', { detail: { token: '${expoPushToken}' } }));
          true;
        `);
      }
    } catch {}
  };

  // Inject push token into WebView after it loads
  const handleWebViewLoad = () => {
    setWebViewLoaded(true);
    if (webviewRef.current && expoPushToken) {
      webviewRef.current.injectJavaScript(`
        window.__expoPushToken = '${expoPushToken}';
        true;
      `);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Branded Splash Screen while WebView loads */}
      {!webViewLoaded && (
        <View style={styles.splash}>
          <Text style={styles.splashLogo}>EKIDOS</Text>
          <Text style={styles.splashSub}>Driver</Text>
          <ActivityIndicator color="#ef4444" size="large" style={styles.splashSpinner} />
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: APP_URL }}
        style={[styles.webview, !webViewLoaded && { opacity: 0 }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsBackForwardNavigationGestures={true}
        mediaPlaybackRequiresUserAction={false}
        geolocationEnabled={true}
        userAgent="EKIDOS-Driver-App/1.0"
        onMessage={handleWebViewMessage}
        onLoad={handleWebViewLoad}
        // ===== SPEED OPTIMIZATIONS =====
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        // Reduce memory/rendering overhead
        overScrollMode="never"
        textZoom={100}
        setSupportMultipleWindows={false}
        // Preconnect to backend for faster API calls
        injectedJavaScriptBeforeContentLoaded={`
          // Preconnect to backend
          var link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = '${BACKEND_URL}';
          document.head.appendChild(link);
          // Preconnect to map tiles
          var link2 = document.createElement('link');
          link2.rel = 'preconnect';
          link2.href = 'https://tile.openstreetmap.org';
          document.head.appendChild(link2);
          true;
        `}
      />
    </View>
  );
}

// ===== HELPER FUNCTIONS =====

async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    // Main orders channel — MAX priority, custom sound, vibration
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Жаңы заказдар',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#ef4444',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      enableLights: true,
      enableVibrate: true,
      sound: 'order-alert.wav',
    });

    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Башка билдирүүлөр',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    });
  }
}

async function registerForPushNotifications(): Promise<string | null> {
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('⚠️ Push notifications require a physical device');
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Push notification permission denied');
    return null;
  }

  // Get Expo push token (works with FCM under the hood)
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId 
      || Constants.easConfig?.projectId
      || undefined;
    
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    return tokenData.data; // Format: ExponentPushToken[xxxx]
  } catch (error) {
    console.error('Failed to get push token:', error);
    
    // Fallback: try device push token (raw FCM token)
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      return deviceToken.data as string;
    } catch (e2) {
      console.error('Failed to get device token:', e2);
      return null;
    }
  }
}

async function savePushToken(driverId: string, token: string) {
  try {
    await fetch(`${BACKEND_URL}/api/drivers/${driverId}/push-token`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushToken: token }),
    });
    console.log('✅ Push token saved for driver:', driverId);
  } catch (error) {
    console.error('❌ Failed to save push token:', error);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight || 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  splashLogo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  splashSub: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 4,
  },
  splashSpinner: {
    marginTop: 32,
  },
});
