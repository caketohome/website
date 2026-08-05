export const ORDERS_CONSTANTS = {
  ORDER_NUMBER_PREFIX: "CTH",
  DEFAULT_BRANCH_ID: "br_koramangala_01",
  SLOTS: {
    EXPRESS_45MIN: { id: "EXPRESS_45MIN", name: "Express 45-Minute Delivery", slotTime: "Within 45 Mins", additionalFee: 50.0, isAvailable: true },
    STANDARD: { id: "STANDARD", name: "Standard Today Delivery", slotTime: "Today 2 PM - 5 PM", additionalFee: 0.0, isAvailable: true },
    SCHEDULED: { id: "SCHEDULED", name: "Scheduled Delivery", slotTime: "Tomorrow 10 AM - 1 PM", additionalFee: 0.0, isAvailable: true },
    MIDNIGHT: { id: "MIDNIGHT", name: "Surprise Midnight Delivery", slotTime: "Tonight 11:45 PM", additionalFee: 99.0, isAvailable: true },
  },
};
