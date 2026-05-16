import axios from 'axios';
import { toAlphanumeric } from '../utils/squadRef';

const squadAxios = axios.create({
  baseURL: process.env.SQUAD_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const initiatePayment = async ({
  email,
  amount,
  ref,
  name,
  phone,
}: {
  email?: string;
  amount: number;
  ref: string;
  name?: string;
  phone?: string;
}): Promise<any> => {
  const fallbackPhoneEmail = phone ? phone.replace(/\D/g, '') : 'customer';
  const transactionRef = toAlphanumeric(ref);

  const response = await squadAxios.post('/transaction/initiate', {
    email: email || `${fallbackPhoneEmail}@fetcha.app`,
    amount,
    initiate_type: 'inline',
    currency: 'NGN',
    transaction_ref: transactionRef,
    customer_name: name,
    pass_charge: false,
  });

  return response.data;
};

export const verifyTransaction = async (transactionRef: string): Promise<any> => {
  const response = await squadAxios.get(`/transaction/verify/${transactionRef}`);
  return response.data;
};

export const accountLookup = async ({
  bankCode,
  accountNumber,
}: {
  bankCode: string;
  accountNumber: string;
}): Promise<any> => {
  const response = await squadAxios.post('/payout/account/lookup', {
    bank_code: bankCode,
    account_number: accountNumber,
  });
  return response.data;
};

export const fundTransfer = async ({
  accountNumber,
  bankCode,
  accountName,
  amount,
  remark,
  ref,
}: {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amount: number;
  remark: string;
  ref: string;
}): Promise<any> => {
  const transactionRef = toAlphanumeric(`${process.env.SQUAD_MERCHANT_ID || 'merchant'}${ref}`);
  const response = await squadAxios.post('/payout/transfer', {
    account_number: accountNumber,
    bank_code: bankCode,
    account_name: accountName,
    amount: String(amount),
    currency_id: 'NGN',
    remark,
    transaction_reference: transactionRef,
  });
  return response.data;
};

export const requeryTransfer = async (transactionRef: string): Promise<any> => {
  const response = await squadAxios.post('/payout/requery', {
    transaction_reference: toAlphanumeric(`${process.env.SQUAD_MERCHANT_ID || 'merchant'}${transactionRef}`),
  });
  return response.data;
};