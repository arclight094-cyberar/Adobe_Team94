import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  setCustomApiUrl, 
  clearCustomApiUrl, 
  getCachedApiUrl,
  getCurrentApiUrl 
} from '../../constants/api';
import ApiService from '../../services/api';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';

export default function Settings() {
  const { alertState, showAlert, hideAlert } = useAlert();
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Load current API URL on mount
    loadCurrentUrl();
  }, []);

  const loadCurrentUrl = async () => {
    try {
      const url = await getCurrentApiUrl();
      setApiUrl(url);
      setCurrentUrl(url);
    } catch (error) {
      const cachedUrl = getCachedApiUrl();
      setApiUrl(cachedUrl);
      setCurrentUrl(cachedUrl);
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      showAlert('error', 'Error', 'Please enter a valid API URL');
      return;
    }

    // Validate URL format
    try {
      new URL(apiUrl);
    } catch {
      showAlert(
        'error',
        'Error', 
        'Please enter a valid URL\n\nExample: http://192.168.1.100:4000/api/v1/adobe-ps'
      );
      return;
    }

    setLoading(true);
    try {
      await setCustomApiUrl(apiUrl);
      await ApiService.updateBaseUrl(apiUrl);
      setCurrentUrl(apiUrl);
      showAlert('success', 'Success', 'API URL updated successfully!');
    } catch (error: any) {
      showAlert('error', 'Error', error.message || 'Failed to save API URL');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset API URL',
      'Reset to default API URL?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              await clearCustomApiUrl();
              const defaultUrl = await getCurrentApiUrl();
              setApiUrl(defaultUrl);
              setCurrentUrl(defaultUrl);
              await ApiService.updateBaseUrl(defaultUrl);
              showAlert('success', 'Success', 'API URL reset to default');
            } catch (error: any) {
              showAlert('error', 'Error', error.message || 'Failed to reset API URL');
            }
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      showAlert('error', 'Error', 'Please enter a valid API URL first');
      return;
    }

    setLoading(true);
    try {
      const testUrl = apiUrl.replace('/api/v1/adobe-ps', '');
      const response = await fetch(`${testUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as any);
      
      if (response.ok) {
        showAlert('success', 'Success', 'Connection successful! Backend is reachable.');
      } else {
        showAlert('warning', 'Warning', 'Backend responded but may not be configured correctly.');
      }
    } catch (error: any) {
      showAlert(
        'error',
        'Connection Failed',
        `Cannot reach backend at ${apiUrl}\n\n` +
        `Make sure:\n` +
        `1. Backend server is running\n` +
        `2. IP address is correct\n` +
        `3. Device is on same network\n` +
        `4. Firewall allows port 4000`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Backend API Configuration</Text>
        <Text style={styles.subtitle}>
          Update the backend API URL when your IP address changes. No need to modify code!
        </Text>

        <View style={styles.currentUrlContainer}>
          <Text style={styles.currentUrlLabel}>Current API URL:</Text>
          <Text style={styles.currentUrlText}>{currentUrl}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>New API Base URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://192.168.1.100:4000/api/v1/adobe-ps"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
          <Text style={styles.hint}>
            Format: http://YOUR_IP:4000/api/v1/adobe-ps{'\n'}
            Find your IP: Windows (ipconfig) or Mac/Linux (ifconfig)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Save API URL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={handleTestConnection}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Reset to Default</Text>
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Quick Tips:</Text>
          <Text style={styles.infoText}>
            • For Android Emulator: Use 10.0.2.2{'\n'}
            • For iOS Simulator: Use localhost{'\n'}
            • For Physical Device: Use your computer's IP{'\n'}
            • URL is saved automatically and persists across app restarts
          </Text>
        </View>
      </ScrollView>

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
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: 'geistmono',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    fontFamily: 'geistmono',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
    lineHeight: 20,
    fontFamily: 'geistmono',
  },
  currentUrlContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#444',
  },
  currentUrlLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontFamily: 'geistmono',
  },
  currentUrlText: {
    fontSize: 14,
    color: '#4A90E2',
    fontFamily: 'geistmono',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
    fontFamily: 'geistmono',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#444',
    fontFamily: 'geistmono',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'geistmono',
    marginTop: 8,
    lineHeight: 18,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
  },
  testButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  resetButton: {
    backgroundColor: '#666',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: 'geistmono',
  },
  infoContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
    fontFamily: 'geistmono',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
    fontFamily: 'geistmono',
  },
});

