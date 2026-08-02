import { View, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

// Production URL — driver/admin frontend deployed on Vercel
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://ekidos-taxi-frontend.vercel.app';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <WebView
        source={{ uri: APP_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsBackForwardNavigationGestures={true}
        mediaPlaybackRequiresUserAction={false}
        geolocationEnabled={true}
        userAgent="EKIDOS-Driver-App/1.0"
      />
    </View>
  );
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
});
