import React, { createContext, useContext, useMemo, useState } from "react";

import { fullName } from "@/lib/attendance";

type User = {
  email: string;
  firstName: string;
  lastName: string;
  linkedin: string; 
  instagram: string; 
  school: string; 
  major: string; 
  interests: string;
  profilePictureUrl: string;
  groupNumber?: number | null;
};

type ScheduleEvent = {
  optionID: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  day: string;
  type: string;
  idSpeaker: string;
  speakers?: Speaker[];
};

type Speaker = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  bio: string | null;
  event: string | null;
  day: string | null;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  schedule: ScheduleEvent[];
  setSchedule: (schedule: ScheduleEvent[]) => void;
  scheduleWithNames: ScheduleEvent[]; // Add this
  speakersAll: Speaker[];
  setSpeakersAll: (speakers: Speaker[]) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [speakersAll, setSpeakersAll] = useState<Speaker[]>([]);
  

  const scheduleWithNames = useMemo(() => {
    if (!schedule.length || !speakersAll.length) return schedule;

    const speakerMap = new Map(
      speakersAll.map((speaker) => [speaker.id, speaker])
    );

    return schedule.map((event) => {
      // Nameless rows are placeholders (the recruitment session), not people.
      const speakers = (event?.idSpeaker ?? "")
        .split(",")
        .map((id) => speakerMap.get(id.trim()))
        .filter((s): s is Speaker => s !== undefined && fullName(s) !== "");

      return {
        ...event,
        speakers,
      };
    });
  }, [schedule, speakersAll]);

  return (
    <UserContext.Provider value={{ user, setUser, schedule, setSchedule, scheduleWithNames, speakersAll, setSpeakersAll }}>
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