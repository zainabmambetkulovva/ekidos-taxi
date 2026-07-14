import { View, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

// Сенин компьютериңдин IP + Next.js порту
const APP_URL = 'http://192.168.1.151:3001';

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
