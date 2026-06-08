import { View, FlatList, Text, TouchableOpacity, Alert } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useRef, useState } from "react";
import Button from "../../components/Button";
import QRCode from "react-native-qrcode-svg";
import { useUser } from "../../contexts/UserContext";
import { CameraView, useCameraPermissions } from "expo-camera"; 
import {supabase} from "../../lib/supabase";

export default function QR() {
  const { user } = useUser();
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedEmail, setScannedEmail] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processingScan, setProcessingScan] = useState(false);
  const isScanning = useRef(false);
  if (showScanner) {
  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={async ({ data }) => {
        if (processingScan) return;
        if (scanned) return;
        if (isScanning.current) {
          return;
        }
        isScanning.current = true;
        setProcessingScan(true);
        setShowScanner(false);

        const { data: attendee, error } = await supabase
          .from("attendeeProfile")
          .select("firstName, lastName, email")
          .eq("email", data)
          .single();

        if (error || !attendee) {
          setProcessingScan(false);
          return;
        }

        Alert.alert(
          "Profile Found",
          `Add ${attendee.firstName} ${attendee.lastName} to your network?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                setProcessingScan(false);
              },
            },
            {
              text: "Add Profile",
              onPress: async () => {
                if (!user?.email) {
                  setProcessingScan(false);
                  return;
                }

                const { data: me, error: fetchError } = await supabase
                  .from("attendeeProfile")
                  .select("network")
                  .eq("email", user.email)
                  .single();

                if (fetchError) {
                  console.log(fetchError);
                  setProcessingScan(false);
                  return;
                }

                const currentConnections =
                  typeof me?.network === "string" ? me.network : "";

                const emailToAdd = attendee.email;

                const updatedConnections =
                  currentConnections.trim() === ""
                    ? emailToAdd
                    : `${currentConnections},${emailToAdd}`;

                const { error: updateError } = await supabase
                  .from("attendeeProfile")
                  .update({ network: updatedConnections })
                  .eq("email", user.email);

                if (updateError) {
                  console.log(updateError);
                }

                setProcessingScan(false);
              },
            },
          ],
          { cancelable: false } 
        );
        setTimeout(() => {
          isScanning.current = false;
        }, 2500); 
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
        setScanned(false);
        setShowScanner(true);
        }} />
    </View>
  )};