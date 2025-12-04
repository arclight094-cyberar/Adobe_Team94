import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react-native';

export type AlertType = 'success' | 'warning' | 'error';

interface CustomAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function CustomAlert({
  visible,
  type,
  title,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 3000,
}: CustomAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const handleClose = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [scaleAnim, onClose]);

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();

      if (autoClose) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoCloseDelay);

        return () => clearTimeout(timer);
      }
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, autoClose, autoCloseDelay, handleClose, scaleAnim]);

  const getAlertConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#A3D977',
          icon: CheckCircle,
          iconColor: '#2D5016',
          textColor: '#1A1A1A',
          label: 'SUCCESS',
        };
      case 'warning':
        return {
          backgroundColor: '#FFE066',
          icon: AlertTriangle,
          iconColor: '#806600',
          textColor: '#1A1A1A',
          label: 'WARNING',
        };
      case 'error':
        return {
          backgroundColor: '#FF6B6B',
          icon: XCircle,
          iconColor: '#8B0000',
          textColor: '#1A1A1A',
          label: 'ERROR',
        };
      default:
        return {
          backgroundColor: '#A3D977',
          icon: CheckCircle,
          iconColor: '#2D5016',
          textColor: '#1A1A1A',
          label: 'SUCCESS',
        };
    }
  };

  const config = getAlertConfig();
  const IconComponent = config.icon;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: config.backgroundColor,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <IconComponent size={24} color={config.iconColor} strokeWidth={2.5} />
            <Text style={[styles.label, { color: config.textColor }]}>
              {config.label}
            </Text>
          </View>

          <Text style={[styles.message, { color: config.textColor }]}>
            {message}
          </Text>

          <TouchableOpacity
            style={styles.okButton}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'geistmono',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: 'geistmono',
  },
  okButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: 'flex-end',
    minWidth: 80,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'geistmono',
  },
});
