import { View, FlatList, Text, TouchableOpacity,  } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useState } from "react";
import Button from "../../components/Button";
import QRCode from "react-native-qrcode-svg";
import { useUser } from "../../contexts/UserContext";
import { CameraView, useCameraPermissions } from "expo-camera"; 

export default function QR() {
  const { user } = useUser();
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  if (showScanner) {
      return (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={({ data }) => {
            console.log("QR Code:", data);

            setShowScanner(false);

          }}
        />
      );
    }
    return (
    <View style={{padding: 16}}>
      <Text style={[ theme.typography.biggestTitle, {color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 16 }]}>
            QR Code
      </Text>
      <Text style={[ theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16}]}>
        Scan your QR code to take attendance, or scan other attendees' QR codes to add them to your network!
      </Text>

      <Card>
        <View style={{ alignItems: "center" }}>
          {user?.email && (
            <QRCode
              value={user.email}
              size={250}
            />
          )}
        </View>
      </Card>

      <Button title="Open camera to scan QR code" variant="secondary"
      onPress={async () => {
        if (!cameraPermission?.granted) {
          const result = await requestCameraPermission();
          if (!result.granted) return;
        }
        setShowScanner(true);
        }} />
    </View>
  )};