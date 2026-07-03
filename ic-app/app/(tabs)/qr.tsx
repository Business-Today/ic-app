import { View, FlatList, Text, TouchableOpacity, Alert } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useRef, useState } from "react";
import Button from "../../components/Button";
import QRCode from "react-native-qrcode-svg";
import { useUser } from "../../contexts/UserContext";
import { CameraView, useCameraPermissions } from "expo-camera"; 
import { supabase } from "../../lib/supabase";

export default function QR() {
  const { user } = useUser();
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [processingScan, setProcessingScan] = useState(false);
  const isScanning = useRef(false);
  const [scanned, setScanned] = useState(false);
  const scanningRef = useRef(false);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanning.current) return;
    if (scanned) return;
    isScanning.current = true;
    setScanned(true);

            const { data: attendee, error } = await supabase
              .from("attendeeProfile")
              .select("firstName, lastName, email")
              .eq("email", data)
              .single();

            if (error || !attendee) {
              Alert.alert("QR Code Error", "No profile found for this QR code.", [
                {
                    text: "OK",
                    onPress: () => {
                      setScanned(false);
                      isScanning.current = false;
                    },
                  },
                ]);
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
                    isScanning.current = false;
                  },
                },
                {
                  text: "Add Profile",
                  onPress: async () => {
                    if (!user?.email) {
                      Alert.alert("Error", "User email not found.");
                      setProcessingScan(false);
                      isScanning.current = false;
                      return;
                    }

                    const { data: me, error: fetchError } = await supabase
                      .from("attendeeProfile")
                      .select("network")
                      .eq("email", user.email)
                      .single();

                    if (fetchError) {
                      console.log(fetchError);
                      Alert.alert("Error", "Failed to fetch your network.");
                      setProcessingScan(false);
                      isScanning.current = false;
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
                      Alert.alert("Error", "Failed to add profile to network.");
                    } else {
                      Alert.alert("Success", `${attendee.firstName} added to your network!`);
                    }
                    setScanned(false);
                    isScanning.current = false;

                    setProcessingScan(false);
                  },
                },
              ],
              { cancelable: false }
            );
          };

  // Handle permission loading state
  if (!cameraPermission) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // Handle permission denied before showing scanner
  if (showScanner && !cameraPermission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text style={[theme.typography.title, { color: theme.colors.primaryBlue, marginBottom: 16 }]}>
          Camera Permission Required
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray, marginBottom: 16 }]}>
          You need to grant camera permission to scan QR codes.
        </Text>
        <Button title="Grant Permission" onPress={requestCameraPermission} />
        <Button
          title="Go Back"
          variant="secondary"
          onPress={() => setShowScanner(false)}
        />
      </View>
    );
  }

  // Scanner view (only when permission is granted)
  if (showScanner && cameraPermission.granted) {
    console.log("Camera permission granted, showing scanner.");
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <Button
            title="Close Scanner"
            onPress={() => setShowScanner(false)}
          />
        </View>
      </View>
    );
  }

  // Main QR code view
  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Text
        style={[
          theme.typography.biggestTitle,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        QR Code
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.primaryDarkGray,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        Scan your QR code to take attendance, or scan other attendees' QR codes
        to add them to your network!
      </Text>

      <Card>
        <View style={{ alignItems: "center" }}>
          {user?.email && (
            <QRCode value={user.email} size={250} />
          )}
        </View>
      </Card>

      <Button
        title="Open camera to scan QR code"
        variant="secondary"
        onPress={async () => {
          if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
              Alert.alert(
                "Permission Denied",
                "You need to grant camera permission to scan QR codes."
              );
              return;
            }
          }
          setShowScanner(true);
        }}
      />
    </View>
  );
}