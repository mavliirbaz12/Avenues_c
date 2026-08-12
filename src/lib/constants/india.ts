/** All 28 states and 8 union territories, for the address form dropdown. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Indian mobile numbers: ten digits starting 6-9, optional +91 prefix. */
export const PHONE_REGEX = /^(\+?91[-\s]?)?[6-9]\d{9}$/;

/** Six digits, never starting with 0. */
export const PINCODE_REGEX = /^[1-9]\d{5}$/;

export const ADDRESS_TYPE_LABELS = {
  HOME: "Home",
  WORK: "Work",
  OTHER: "Other",
} as const;
