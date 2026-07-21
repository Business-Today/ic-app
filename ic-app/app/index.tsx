import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("loggedInEmail").then(email => {
      setHasUser(!!email);
    });
  }, []);

  if (hasUser === null) return null; // loading

  

  return hasUser ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;

}