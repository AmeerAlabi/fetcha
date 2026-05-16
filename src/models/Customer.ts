import { Schema, model, Types } from 'mongoose';

export type CustomerState =
  | 'IDLE'
  | 'CONFIRMING_PHONE'
  | 'SELECTING_ROLE'
  | 'ONBOARDING_NAME'
  | 'ONBOARDING_LOCATION'
  | 'SEARCHING'
  | 'AWAITING_PROVIDER_SELECTION'
  | 'AWAITING_BOOKING_PAYMENT'
  | 'AWAITING_CONFIRMATION'
  | 'RATING';

const customerSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    contactPhone: { type: String },
    name: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    state: {
      type: String,
      default: 'IDLE',
    },
    currentBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    searchResults: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
  },
  { timestamps: true },
);

export interface CustomerDocument {
  _id: Types.ObjectId;
  phone: string;
  contactPhone?: string;
  name?: string;
  location?: { lat?: number; lng?: number };
  state: CustomerState;
  currentBookingId?: Types.ObjectId;
  searchResults: Types.ObjectId[];
}

export const Customer = model<CustomerDocument>('Customer', customerSchema);
export default Customer;