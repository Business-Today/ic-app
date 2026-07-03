import * as Notifications from 'expo-notifications';
import * as Constants from 'expo-constants';

async function registerForPushNotifications() {
  let token;

  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    throw new Error('Must use a physical device for push notifications');
  }

  return token;
}