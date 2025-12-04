import { useState, useCallback } from 'react';
import { AlertType } from '../components/CustomAlert';

interface AlertState {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showAlert = useCallback((type: AlertType, title: string, message: string) => {
    setAlertState({
      visible: true,
      type,
      title,
      message,
    });
  }, []);

  const showAlertFromResponse = useCallback((statusCode: number, message?: string) => {
    let type: AlertType = 'success';
    let title = '';
    let defaultMessage = '';

    if (statusCode >= 200 && statusCode < 300) {
      type = 'success';
      title = 'SUCCESS';
      defaultMessage = 'Operation completed successfully.';
    } else if (statusCode >= 400 && statusCode < 500) {
      type = 'error';
      title = 'ERROR';
      defaultMessage = 'An error occurred. Please try again.';
    } else if (statusCode >= 500) {
      type = 'error';
      title = 'ERROR';
      defaultMessage = 'Server error. Please try again later.';
    } else {
      type = 'warning';
      title = 'WARNING';
      defaultMessage = 'Something unexpected happened.';
    }

    setAlertState({
      visible: true,
      type,
      title,
      message: message || defaultMessage,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  return {
    alertState,
    showAlert,
    showAlertFromResponse,
    hideAlert,
  };
}
