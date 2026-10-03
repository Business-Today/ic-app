export type EmergencyContact = {
  id: string;
  name: string;
  subtitle: string;
  phone: string;
};

/**
 * Contacts shown under Home > Emergency.
 * Update the names and numbers before the conference.
 */
export const emergencyContacts: EmergencyContact[] = [
  {
    id: "conference-director",
    name: "Conference Director",
    subtitle: "Jane Doe",
    phone: "",
  },
  {
    id: "assistant-director",
    name: "Assistant Director",
    subtitle: "John Doe",
    phone: "",
  },
  {
    id: "hotel-security",
    name: "Hotel Security",
    subtitle: "Hilton Front Desk",
    phone: "",
  },
  {
    id: "emergency-services",
    name: "911",
    subtitle: "",
    phone: "911",
  },
];
