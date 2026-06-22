import React, { createContext, useContext, useState, useMemo } from "react";

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

type Speaker = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  event: string;
  day: string;
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
      let speakerNames = (event?.idSpeaker ?? "")
        .split(",")
        .map((id) => speakerMap.get(id.trim()))
        .filter((s): s is Speaker => s !== undefined)
        .map((s) => `${s.firstName} ${s.lastName}`)
        .join(", ");

      return {
        ...event,
        idSpeaker: speakerNames,
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