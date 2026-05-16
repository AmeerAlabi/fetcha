import { Schema, model, Types } from 'mongoose';

export type ProviderState =
  | 'IDLE'
  | 'SELECTING_ROLE'
  | 'ONBOARDING_NAME'
  | 'ONBOARDING_SERVICE'
  | 'ONBOARDING_DESCRIPTION'
  | 'ONBOARDING_LOCATION'
  | 'ONBOARDING_PRICING'
  | 'ONBOARDING_BANK'
  | 'ONBOARDING_AVAILABILITY'
  | 'ONBOARDING_IMAGE'
  | 'AWAITING_VERIFICATION_PAYMENT'
  | 'ACTIVE';

const providerSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    contactPhone: { type: String },
    name: { type: String },
    serviceType: { type: String },
    serviceDescription: { type: String },
    serviceArea: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      description: { type: String },
    },
    price: { 
      type: Number, 
      min: [1, 'Price must be at least NGN 1'],
      max: [10000000, 'Price cannot exceed NGN 10,000,000'],
    },
    profileImageUrl: { type: String },
    bankDetails: {
      accountNumber: { type: String },
      bankCode: { type: String },
      bankName: { type: String },
      accountName: { type: String },
    },
    availability: { type: String },
    verified: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    trustScore: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    state: {
      type: String,
      default: 'IDLE',
    },
  },
  { timestamps: true },
);

export interface ProviderDocument {
  _id: Types.ObjectId;
  phone: string;
  contactPhone?: string;
  name?: string;
  serviceType?: string;
  serviceDescription?: string;
  serviceArea?: string;
  location?: { lat?: number; lng?: number; description?: string };
  price?: number;
  profileImageUrl?: string;
  bankDetails?: {
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
    accountName?: string;
  };
  availability?: string;
  verified: boolean;
  suspended: boolean;
  trustScore: number;
  totalRatings: number;
  ratingCount: number;
  completedBookings: number;
  state: ProviderState;
}

export const Provider = model<ProviderDocument>('Provider', providerSchema);
export default Provider;