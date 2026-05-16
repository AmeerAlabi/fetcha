import { Schema, model, Types } from 'mongoose';

const bookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    customerPhone: { type: String },
    customerContactPhone: { type: String },
    providerPhone: { type: String },
    providerContactPhone: { type: String },
    serviceType: { type: String },
    amount: { 
      type: Number, 
      required: true, 
      min: [1, 'Booking amount must be at least NGN 1'],
      max: [10000000, 'Booking amount cannot exceed NGN 10,000,000'],
    },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'confirmed', 'completed', 'disputed'],
    },
    squadPaymentRef: { type: String },
    squadPayoutRef: { type: String },
    rating: { type: Number },
  },
  { timestamps: true },
);

export interface BookingDocument {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerPhone?: string;
  customerContactPhone?: string;
  providerPhone?: string;
  providerContactPhone?: string;
  serviceType?: string;
  amount?: number;
  status: 'pending' | 'confirmed' | 'completed' | 'disputed';
  squadPaymentRef?: string;
  squadPayoutRef?: string;
  rating?: number;
}

export const Booking = model<BookingDocument>('Booking', bookingSchema);
export default Booking;