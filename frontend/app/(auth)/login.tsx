// app/(auth)/login.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import apiService from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { colors } = useTheme();
  const { alertState, showAlert, showAlertFromResponse, hideAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between login and signup
  const [name, setName] = useState(''); // Only for signup
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google OAuth Configuration
  const GOOGLE_CLIENT_ID = 
    Platform.OS === 'android' 
      ? (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '')
      : Platform.OS === 'ios'
      ? (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '')
      : (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '');

  // For Android: No redirect URI needed (uses native authentication)
  // For iOS/Web: Need redirect URI
  const redirectUri = Platform.OS === 'android' 
    ? undefined 
    : (process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || 
       AuthSession.makeRedirectUri({
         scheme: 'arclight',
         path: 'oauth',
       }));

  // Configure Google Auth Request
  const googleAuthConfig: any = {
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  };

  // Only add redirectUri for non-Android platforms
  if (redirectUri && Platform.OS !== 'android') {
    googleAuthConfig.redirectUri = redirectUri;
  }

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleAuthConfig);

  // Handle Google Auth Response
  useEffect(() => {
    if (!response) {
      return;
    }
    
    if (response.type === 'success') {
      const idToken = (response as any).params?.id_token;
      if (idToken) {
        handleGoogleAuthSuccess(idToken);
      }
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      const errorMessage = response.error?.message || 'Google authentication failed. Please try again.';
      showAlert('error', 'ERROR', errorMessage);
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [response]);

  // ============================================================
  // LOGIN HANDLER
  // Authenticates user and stores JWT token
  // ============================================================
  const handleLogin = async () => {
    // Validate input fields
    if (!email.trim() || !password.trim()) {
      showAlert('error', 'ERROR', 'Please fill all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('error', 'ERROR', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // API Call: POST /auth/login using API service
      const { response, data } = await apiService.login(email.trim(), password);

      console.log('Login response:', { ok: response.ok, status: response.status, data });

      if (response.ok && data.success === true) {
        // Token and user data are already stored by apiService
        
        // Show success message and navigate to main app
        showAlertFromResponse(200, 'Login successful!');
        
        setTimeout(() => {
          router.replace('/(app)/home');
        }, 1500);

        // Clear form fields
        setEmail('');
        setPassword('');
      } else {
        // Handle error response from backend
        // Backend returns { status: 'fail'/'error', message: '...' } for errors
        const errorMessage = data.message || data.error?.message || 'Login failed. Please try again.';
        showAlert('error', 'ERROR', errorMessage);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide more specific error messages
      if (error.name === 'NetworkError' || error.message?.includes('Network request failed')) {
        showAlert(
          'error',
          'ERROR',
          'Cannot connect to backend server. Please check if the server is running and you are on the same network.'
        );
      } else {
        showAlert('error', 'ERROR', error.message || 'Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SIGNUP HANDLER
  // Creates new user account and sends OTP
  // ============================================================
  const handleSignUp = async () => {
    // Validate input fields
    if (!name.trim() || !email.trim() || !password.trim()) {
      showAlert('error', 'ERROR', 'Please fill all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('error', 'ERROR', 'Please enter a valid email address');
      return;
    }

    // Password validation (minimum 6 characters)
    if (password.length < 6) {
      showAlert('error', 'ERROR', 'Password must be at least 6 characters');
      return;
    }

    //setLoading(true);

    try {
      // API Call: POST /auth/signup using API service
      const { response, data } = await apiService.signup(name.trim(), email.trim(), password);

      console.log('Signup response:', { ok: response.ok, status: response.status, data });

      if (response.ok && data.success === true) {
        // Store email and password temporarily for OTP verification and auto-login
        await AsyncStorage.setItem('pending_email', email.trim());
        await AsyncStorage.setItem('pending_password', password); // Store for auto-login after OTP
        
        // Clear form fields
        setName('');
        setEmail('');
        setPassword('');
        
        // Navigate directly to OTP verification screen
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { email: email.trim() }
        });
      } else {
        // Handle error response from backend
        showAlert('error', 'ERROR', data.message || 'Signup failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Provide more specific error messages
      if (error.name === 'NetworkError' || error.message?.includes('Network request failed')) {
        showAlert(
          'error',
          'ERROR',
          'Cannot connect to backend server. Please check if the server is running and you are on the same network.'
        );
      } else {
        showAlert('error', 'ERROR', error.message || 'Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CONTINUE BUTTON HANDLER
  // Routes to login or signup based on current mode
  // ============================================================
  const handleContinue = () => {
    if (isSignUp) {
      handleSignUp();
    } else {
      handleLogin();
    }
  };

  // ============================================================
  // TOGGLE BETWEEN LOGIN AND SIGNUP
  // ============================================================
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    // Clear form fields when toggling
    setName('');
    setEmail('');
    setPassword('');
  };

  // ============================================================
  // GOOGLE AUTH HANDLERS
  // ============================================================
  const handleGoogleAuth = async () => {
    // Check if running in Expo Go (which doesn't support native Google Sign-In)
    if (Constants.appOwnership === 'expo' && Platform.OS !== 'web') {
      Alert.alert(
        'Development Build Required',
        'Google Sign-In requires a development build, not Expo Go.\n\n' +
        'To use Google Sign-In:\n' +
        '1. Build a development build: npx expo prebuild\n' +
        '2. Run: npx expo run:android\n' +
        '3. Or use EAS Build: eas build --profile development --platform android\n\n' +
        'Expo Go does not support native Google Sign-In.'
      );
      return;
    }
    
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === '') {
      Alert.alert(
        'Configuration Error',
        `Google OAuth Client ID is not configured for ${Platform.OS}.\n\n` +
        `Please add the following to your .env file:\n` +
        `- EXPO_PUBLIC_GOOGLE_${Platform.OS === 'android' ? 'ANDROID' : Platform.OS === 'ios' ? 'IOS' : 'WEB'}_CLIENT_ID\n` +
        `- Or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as fallback\n\n` +
        `See GOOGLE_AUTH_COMPLETE_SETUP.md for detailed instructions.`
      );
      return;
    }

    if (!request) {
      Alert.alert('Error', 'Google auth is not ready. Please wait a moment and try again.');
      return;
    }

    setGoogleLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Google OAuth prompt timed out after 30 seconds. Please check your Android Client ID configuration and SHA-1 fingerprint in Google Cloud Console.'));
        }, 30000);
      });
      
      const result = await Promise.race([
        promptAsync(),
        timeoutPromise
      ]) as any;
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleLoading(false);
        return;
      }
    } catch (error: any) {
      setGoogleLoading(false);
      let errorMessage = error.message || 'Failed to start Google authentication.';
      
      if (Platform.OS === 'android') {
        errorMessage += '\n\nFor Android OAuth:\n';
        errorMessage += '1. Verify the Android Client ID is correct in Google Cloud Console\n';
        errorMessage += '2. Ensure SHA-1 fingerprint is registered\n';
        errorMessage += '3. Check that package name matches: com.arclight.app\n';
        errorMessage += '4. Try rebuilding the app: npx expo prebuild && npx expo run:android';
      }
      
      Alert.alert('Google Auth Error', errorMessage);
    }
  };

  const handleGoogleAuthSuccess = async (idToken: string) => {
    try {
      const { response, data } = await apiService.googleAuth(idToken);

      if (response.ok && data.success === true) {
        console.log('✅ Google auth successful!');
        router.replace('/(app)/home');
      } else {
        const errorMessage = data.message || data.error?.message || 'Google authentication failed.';
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      console.error('Google auth API error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to authenticate with Google. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.auth.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              {/* Arclight SVG Logo */}
              <Svg width={120} height={120} viewBox="0 0 1500 1500">
                <Path
                  d="M740.131 69.8554C752.115 68.7019 764.209 69.7049 775.839 72.8166C826.937 86.3694 843.055 129.401 867.289 171.325L931.701 282.667C923.847 297.338 913.633 314.008 905.217 328.564L852.243 420.197L691.918 697.608L650.165 769.683C646.547 775.917 628.506 805.95 627.924 810.383C626.273 822.957 626.955 850.456 626.957 863.86L626.987 987.781C562.553 986.3 492.896 987.483 428.101 987.493L357.729 987.569C346.649 987.588 330.44 988.42 319.859 986.738C276.915 979.911 239.516 941.423 234.634 897.844C232.579 879.109 235.813 860.173 243.97 843.181C250.611 828.997 265.021 805.747 273.45 791.211L326.405 699.638L496.916 404.595L615.128 200.132L647.182 144.55C653.953 132.793 662.478 116.75 670.744 106.509C688.491 84.5208 712.361 72.9028 740.131 69.8554Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M1056.25 498.471C1071 522.204 1086.51 550.58 1100.63 575.019L1182.49 716.703L1230.15 799.101C1249.24 832.096 1269.59 858.961 1263.74 899.414C1257.21 944.534 1222.82 978.799 1178.27 987.081C1170.78 988.474 1157.66 987.617 1149.78 987.555L1104.58 987.471L903.442 987.49L692.699 987.44L775.076 939.929C784.821 934.309 804.886 923.451 812.873 917.033C816.816 913.865 831.287 887.54 834.621 881.753L869.44 821.357L990.123 612.555C1011.74 575.126 1033.89 535.285 1056.25 498.471Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M923.125 1156.06C948.324 1153.42 970.009 1162.39 989.385 1177.74C990.031 1171.7 990.462 1165.58 991.112 1159.47C1006.39 1159.3 1022.08 1159.48 1037.39 1159.49C1038 1179.53 1037.52 1202.08 1037.52 1222.39L1037.56 1328.3C1037.37 1393.3 999.967 1431.72 933.992 1430.57C905.158 1430.06 869.044 1421.04 848.4 1399.67C850.714 1396.58 853.562 1393.18 856 1390.13C863.834 1380.28 871.78 1370.51 879.836 1360.83C894.338 1372.57 912.242 1379.32 930.887 1380.08C944.961 1380.58 960.74 1377.51 971.15 1367.37C984.208 1354.65 983.232 1337.66 983.26 1321.08C969.374 1330.71 956.859 1336.35 939.808 1338.17C915.178 1340.69 890.546 1333.42 871.227 1317.94C852.365 1302.77 840.298 1280.73 837.675 1256.66C835.174 1232.15 842.697 1207.66 858.535 1188.78C874.987 1168.93 897.721 1158.34 923.125 1156.06ZM940.091 1292.56C965.137 1290.95 984.149 1269.36 982.583 1244.31C981.017 1219.26 959.464 1200.21 934.412 1201.74C909.298 1203.26 890.19 1224.88 891.76 1249.99C893.33 1275.1 914.982 1294.17 940.091 1292.56Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M189.713 1156.03C218.191 1152.97 237.8 1160.72 259.866 1177.8L261.156 1159.32L307.492 1159.35C308.08 1218.66 307.685 1279.32 307.47 1338.7C292.046 1338.86 276.621 1338.84 261.197 1338.62C260.682 1332.41 260.253 1326.2 259.911 1319.98C256.182 1323.06 252.566 1325.62 248.638 1328.44C238.169 1335.14 226.396 1339.53 214.099 1341.34C189.122 1344.93 163.752 1338.31 143.704 1322.99C124.327 1308.28 111.619 1286.44 108.399 1262.32C104.777 1237.27 111.375 1211.82 126.709 1191.68C142.368 1171.18 164.353 1159.4 189.713 1156.03ZM211.288 1295.27C236.843 1293.44 256.117 1271.3 254.415 1245.74C252.712 1220.17 230.675 1200.79 205.102 1202.36C179.347 1203.95 159.794 1226.18 161.508 1251.92C163.223 1277.67 185.55 1297.11 211.288 1295.27Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M1072.42 1073.26C1078.3 1072.9 1088.69 1073.37 1094.93 1073.44C1105.42 1073.53 1115.92 1073.43 1126.41 1073.15L1126.3 1179.08C1142.65 1164.68 1156.41 1156.07 1178.71 1155.71C1211.56 1155.19 1235.65 1174.05 1242.94 1206.11C1247.81 1227.53 1246.57 1249.15 1246.56 1271.03L1246.46 1338.7C1228.46 1338.86 1210.46 1338.83 1192.45 1338.61L1192.44 1282.84L1192.54 1256.32C1192.57 1242.52 1194 1224.54 1184.21 1213.7C1173.71 1202.08 1149.61 1203.22 1138.92 1213.85C1133.69 1219.05 1128.92 1226.79 1127.6 1234.17C1125.32 1246.85 1126.22 1260.81 1126.23 1273.73C1126.35 1295.39 1126.32 1317.04 1126.13 1338.7C1108.17 1338.84 1090.22 1338.82 1072.26 1338.64L1072.24 1167.76C1072.23 1136.95 1071.64 1103.93 1072.42 1073.26Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M555.793 1156.8C592.63 1153.08 631.657 1170.07 647.809 1204.57L605.124 1226.07C601.958 1219.24 596.124 1213.23 589.786 1209.2C579.129 1202.56 566.252 1200.48 554.047 1203.43C542.281 1206.17 532.091 1213.49 525.724 1223.75C518.918 1234.75 516.886 1248.05 520.096 1260.57C523.096 1272.62 530.338 1282.95 541.049 1289.34C551.809 1295.68 564.634 1297.51 576.739 1294.45C589.692 1291.12 598.537 1283.37 605.217 1272.08C610.26 1274.43 615.612 1277.24 620.625 1279.74L647.697 1293.41C645.355 1299.13 642.211 1304.48 638.361 1309.3C606.561 1349.37 537.342 1351.09 498.782 1319.78C480.167 1304.73 468.418 1282.8 466.2 1258.96C460.705 1201.73 500.225 1161.72 555.793 1156.8Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M1303.1 1111.81C1316.73 1111.43 1331.87 1111.78 1345.62 1111.8C1345.88 1127.43 1345.71 1143.7 1345.74 1159.38L1394.63 1159.48C1394.81 1173.8 1394.65 1188.42 1394.65 1202.76C1378.34 1202.68 1362.03 1202.74 1345.73 1202.93C1345.48 1216.73 1345.79 1231.53 1345.6 1245.2C1344.96 1293.01 1346.15 1301.73 1394.62 1292.01L1394.69 1330.99C1394.77 1333.36 1395.01 1333.49 1393.95 1335.52C1381.69 1340.41 1361.51 1342.37 1349.04 1342.33C1311 1342.21 1288.45 1320.77 1291.35 1282.06C1291.73 1276.93 1291.37 1267.28 1291.37 1261.61L1291.38 1202.88C1282.38 1202.67 1272.86 1202.8 1263.82 1202.78C1263.72 1188.35 1263.75 1173.91 1263.92 1159.47L1291.44 1159.44L1303.1 1111.81Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M668.825 1073.24C683.347 1072.43 706.049 1073.55 722.126 1073.15C722.666 1104.48 722.19 1137.34 722.193 1168.78L722.124 1338.68C705.018 1339.05 685.657 1338.95 668.53 1338.62L668.52 1162L668.485 1106.35C668.473 1096.47 668.095 1082.85 668.825 1073.24Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M431.459 1155.93C441.98 1154.78 447.677 1155.81 457.738 1158.65C457.91 1175.45 457.402 1193.26 457.072 1210.11C434.059 1202.61 404.782 1203.02 398.246 1233.18C395.567 1245.55 396.743 1263.28 396.761 1276.38L396.743 1338.7L348.45 1338.8C346.435 1338.86 344.99 1339.19 343.387 1338.09C341.927 1332.18 342.913 1298.46 342.916 1290.45L342.997 1159.46L388.713 1159.49C389.453 1167.92 390.467 1176.61 391.348 1185.05C402.529 1169.64 412.351 1159.75 431.459 1155.93Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M759.528 1159.48L813.871 1159.48C814.348 1179.92 813.973 1201.82 813.976 1222.36L813.924 1338.69C796.641 1339.06 776.781 1338.97 759.497 1338.62L759.528 1159.48Z"
                  fill={colors.auth.svg}
                />
                <Path
                  d="M779.598 1077.23C798.422 1073.24 816.894 1085.35 820.755 1104.2C824.615 1123.05 812.387 1141.44 793.51 1145.17C774.816 1148.86 756.644 1136.78 752.82 1118.11C748.997 1099.44 760.956 1081.19 779.598 1077.23Z"
                  fill={colors.auth.svg}
                />
              </Svg>
            </View>
            {/* <Text style={[styles.logoText, { color: colors.auth.text }]}>arclight</Text> */}
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>

            {/* Name Input - Only show for signup */}
            {isSignUp && (
              <View style={[styles.inputContainer, { borderColor: colors.auth.inputBorder }]}>
                <TextInput
                  style={[styles.input, { color: colors.auth.text }]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.auth.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            )}

            {/* Email Input */}
            <View style={[styles.inputContainer, { borderColor: colors.auth.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.auth.text }]}
                placeholder="Email address"
                placeholderTextColor={colors.auth.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { borderColor: colors.auth.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.auth.text }]}
                placeholder="Password"
                placeholderTextColor={colors.auth.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: colors.auth.button }, loading && styles.continueButtonDisabled]}
              onPress={handleContinue}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.auth.text} />
              ) : (
                <Text style={[styles.continueButtonText, { color: colors.auth.text }]}>
                  {isSignUp ? 'SIGN UP' : 'CONTINUE'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Login/Signup */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleText, { color: colors.auth.textLight }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleMode} disabled={loading}>
                <Text style={[styles.toggleLink, { color: colors.auth.button }]}>
                  {isSignUp ? 'Log in' : 'Sign up'}
                </Text>
              </TouchableOpacity>
            </View>

            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  
  // ========== LOGO STYLES ==========
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoIcon: {
    width: 80,
    height: 80,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'geistmono',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'geistmono',
  },
  
  // ========== FORM STYLES ==========
  formContainer: {
    width: '100%',
    gap: 16,
  },
  inputContainer: {
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  input: {
    fontSize: 16,
    padding: 0,
    fontFamily: 'geistmono',
  },
  
  // ========== BUTTON STYLES ==========
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 0.5,
    fontFamily: 'geistmono',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    fontFamily: 'geistmono',
  },
  continueButton: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: 'geistmono',
  },
  
  // ========== TOGGLE STYLES ==========
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'geistmono',
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'geistmono',
  },
  
  // ========== FORGOT PASSWORD STYLES ==========
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#3C44A8',
    fontWeight: '500',
    fontFamily: 'geistmono',
  },
});