// Shared types used by the web app.

export type AppRole = 'participant' | 'parent' | 'coach' | 'admin';

export type Course = {
  id: string;
  city: string;
  venue: string;
  day: string;
  from: string;
  to: string;
  price: string;
  priceAmount: number;
  capacityTotal: number;
  capacityCurrent: number;
};

export type Camp = {
  id: string;
  place: string;
  venue: string;
  season: string;
  price: string;
  priceAmount: number;
  capacityTotal: number;
  capacityCurrent: number;
  highlights: string[];
  terms?: Array<{ id: string; label: string; dates: string }>;
};

export type Workshop = {
  id: string;
  city: string;
  place: string;
  date: string;
  price: string;
  capacityTotal: number;
  capacityCurrent: number;
  body: string;
};

export type Testimonial = {
  name: string;
  text: string;
};

export type AboutPillar = {
  title: string;
  body: string;
};

export type Stat = {
  value: string;
  label: string;
};

export type Contacts = {
  phone: string;
  email: string;
  ico: string;
  bank: string;
  social: string[];
  cities: string[];
};
