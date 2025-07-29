export interface Participant {
  // Backend identification fields (not displayed)
  ID: string;
  PARTICIPANT_NUM: string;
  SERIAL_NUM: string;
  
  // Guest details (displayed at top)
  RESERVATION_NUM: string;
  NAME: string;
  HOTEL: string;
  ADULTS: number;
  START: string;
  END: string;
  
  // Events (displayed as cards if not "NO")
  OPENING: string;
  RB1: string;
  SOUPS: string;
  COCKTAIL: string;
  RB2: string;
  PRIZES: string;
  WOW: string;
}

export interface EventInfo {
  name: string;
  value: string;
  description: string;
  icon: string;
}