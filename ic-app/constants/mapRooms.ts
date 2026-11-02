export type FloorKey = "concourse" | "third" | "fourth";

/** A box in the coordinates of a floor's svg viewBox. */
export type MapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MapRoom = {
  floor: FloorKey;
  /** Names a schedule location may use for this room. */
  names: string[];
  rect: MapRect;
};

/**
 * Rooms that schedule locations can link to. Names shared by two spaces (the
 * Floor 4 lounges, the prefunction areas) are left out rather than guessed at.
 */
const MAP_ROOMS: MapRoom[] = [
  { floor: "concourse", names: ["Concourse A"], rect: { x: 1241, y: 175, width: 296, height: 301 } },
  { floor: "concourse", names: ["Concourse B"], rect: { x: 845, y: 327, width: 138, height: 243 } },
  { floor: "concourse", names: ["Concourse C"], rect: { x: 693, y: 361, width: 152, height: 209 } },
  { floor: "concourse", names: ["Concourse D"], rect: { x: 542, y: 361, width: 151, height: 209 } },
  { floor: "concourse", names: ["Concourse E"], rect: { x: 390, y: 327, width: 151, height: 243 } },
  { floor: "concourse", names: ["Concourse F"], rect: { x: 385, y: 711, width: 157, height: 152 } },
  { floor: "concourse", names: ["Concourse G"], rect: { x: 542, y: 711, width: 299, height: 152 } },
  { floor: "concourse", names: ["Concourse H"], rect: { x: 841, y: 711, width: 141, height: 152 } },

  // The schedule's plain "Ballroom" means the Grand Ballroom.
  { floor: "third", names: ["Grand Ballroom", "Ballroom"], rect: { x: 147, y: 389, width: 432, height: 194 } },
  { floor: "third", names: ["Grand Ballroom West"], rect: { x: 147, y: 389, width: 146, height: 194 } },
  { floor: "third", names: ["Grand Ballroom East"], rect: { x: 293, y: 389, width: 286, height: 194 } },
  { floor: "third", names: ["Grand Ballroom West Foyer"], rect: { x: 175, y: 218, width: 118, height: 130 } },
  { floor: "third", names: ["Grand Ballroom East Foyer"], rect: { x: 293, y: 218, width: 257, height: 130 } },
  { floor: "third", names: ["Rotunda"], rect: { x: 918, y: 218, width: 133, height: 149 } },
  { floor: "third", names: ["Mercury Ballroom", "Mercury"], rect: { x: 915, y: 368, width: 140, height: 169 } },
  { floor: "third", names: ["Petit Trianon"], rect: { x: 1130, y: 214, width: 123, height: 151 } },
  { floor: "third", names: ["Trianon Ballroom", "Trianon"], rect: { x: 1091, y: 365, width: 159, height: 218 } },
  { floor: "third", names: ["Rendezvous Trianon", "Rendezvous"], rect: { x: 1089, y: 119, width: 184, height: 93 } },
  { floor: "third", names: ["Promenade"], rect: { x: 607, y: 119, width: 240, height: 93 } },
  { floor: "third", names: ["West Promenade"], rect: { x: 249, y: 157, width: 325, height: 55 } },
  { floor: "third", names: ["East Promenade"], rect: { x: 873, y: 157, width: 211, height: 55 } },
  { floor: "third", names: ["Americas Hall Foyer"], rect: { x: 84, y: 163, width: 166, height: 49 } },

  { floor: "fourth", names: ["Lincoln"], rect: { x: 51, y: 143, width: 181, height: 198 } },
  { floor: "fourth", names: ["New York"], rect: { x: 236, y: 143, width: 342, height: 144 } },
  { floor: "fourth", names: ["Hudson"], rect: { x: 579, y: 143, width: 170, height: 144 } },
  { floor: "fourth", names: ["Midtown"], rect: { x: 752, y: 143, width: 166, height: 144 } },
  { floor: "fourth", names: ["Harlem"], rect: { x: 920, y: 143, width: 172, height: 144 } },
  { floor: "fourth", names: ["Holland"], rect: { x: 1094, y: 143, width: 171, height: 144 } },
  { floor: "fourth", names: ["East"], rect: { x: 1268, y: 143, width: 172, height: 194 } },
  { floor: "fourth", names: ["Hilton Boardroom", "Boardroom"], rect: { x: 1279, y: 341, width: 161, height: 201 } },
  { floor: "fourth", names: ["Green"], rect: { x: 234, y: 388, width: 159, height: 152 } },
];

function normalizeRoomName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|room)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROOMS_BY_NAME = new Map(
  MAP_ROOMS.flatMap((room) =>
    room.names.map((name) => [normalizeRoomName(name), room] as const)
  )
);

/**
 * The room a schedule location refers to, if it's on the map. Matches whole
 * names only, on the part before the first comma, so "Petit Trianon, Hallway"
 * finds the room but "11 Wall Street, New York, NY" doesn't find "New York".
 */
export function findMapRoom(location: string | null | undefined) {
  const place = location?.split(",")[0] ?? "";

  return ROOMS_BY_NAME.get(normalizeRoomName(place)) ?? null;
}
