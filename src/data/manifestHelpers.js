import { TOKENS } from "./statusHelpers";

export const FREIGHT_STATUS_COLORS = {
  to_pay: TOKENS.amber,
  prepaid: TOKENS.steel,
  paid: TOKENS.green,
};

export const PAYMENT_STATUS_COLORS = {
  pending: TOKENS.red,
  partial: TOKENS.amber,
  paid: TOKENS.green,
};

export const VESSEL_EVENT_TYPES = [
  "loading",
  "sailed",
  "in_transit",
  "berthed",
  "discharging",
  "discharged",
  "delayed",
  "other",
];

export const VESSEL_EVENT_COLORS = {
  loading: TOKENS.amber,
  sailed: TOKENS.green,
  in_transit: TOKENS.steel,
  berthed: TOKENS.amber,
  discharging: TOKENS.amber,
  discharged: TOKENS.green,
  delayed: TOKENS.red,
  other: TOKENS.steel,
};
