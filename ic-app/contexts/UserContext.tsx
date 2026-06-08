import React, { createContext, useContext, useState } from "react";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  linkedin: string; 
  instagram: string; 
  school: string; 
  major: string; 
  interests: string;
  profilePictureUrl: string;
};

type ScheduleEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  day: string;
  type: string;
  idSpeaker: string;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  schedule: ScheduleEvent[] | null;
  setSchedule: (schedule: ScheduleEvent[]) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  return (
    <UserContext.Provider value={{ user, setUser, schedule, setSchedule }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}