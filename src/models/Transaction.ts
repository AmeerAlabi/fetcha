import { Schema, model, Types } from 'mongoose';

const transactionSchema = new Schema(
  {
    squadRef: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['verification_fee', 'booking_payment', 'payout'],
      required: true,
    },
    amount: { type: Number },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    relatedId: { type: Schema.Types.ObjectId },
    phone: { type: String },
  },
  { timestamps: true },
);

export interface TransactionDocument {
  _id: Types.ObjectId;
  squadRef: string;
  type: 'verification_fee' | 'booking_payment' | 'payout';
  amount?: number;
  status: 'pending' | 'success' | 'failed';
  relatedId?: Types.ObjectId;
  phone?: string;
}

export const Transaction = model<TransactionDocument>('Transaction', transactionSchema);
export default Transaction;