import Provider, { ProviderDocument } from '../models/Provider';
import Transaction from '../models/Transaction';
import { initiatePayment } from '../services/squadService';
import { uploadBase64Image } from '../services/cloudinaryService';
import { buildSquadRef } from '../utils/squadRef';

// Bank code mapping for common Nigerian banks
const BANK_CODES: { [key: string]: string } = {
  gtbank: '000013',
  'gt bank': '000013',
  access: '000014',
  'access bank': '000014',
  zenith: '000015',
  'zenith bank': '000015',
  firstbank: '000016',
  'first bank': '000016',
  uba: '000004',
  'united bank': '000004',
  fidelity: '000007',
  'fidelity bank': '000007',
  fcmb: '000003',
  'first city': '000003',
  union: '000018',
  'union bank': '000018',
  sterling: '000001',
  'sterling bank': '000001',
  wema: '000017',
  'wema bank': '000017',
  kuda: '090267',
  opay: '100004',
  palmpay: '100033',
  moniepoint: '100004',
};

export const handleProvider = async (
  client: any,
  message: any,
  provider: ProviderDocument,
  phone: string,
  body: string,
) => {
  const state = provider.state;
  const from = message.from;

  // ONBOARDING — NAME
  if (state === 'ONBOARDING_NAME') {
    await Provider.findOneAndUpdate({ phone }, { name: body, state: 'ONBOARDING_SERVICE' });
    await client.sendMessage(
      from,
      `Welcome, ${body}! What service do you offer?\n\nReply with one of these:\n1. food\n2. hair_beauty\n3. fashion\n4. photography\n5. home_services`,
    );
    return;
  }

  // ONBOARDING — SERVICE DESCRIPTION
  if (state === 'ONBOARDING_DESCRIPTION') {
    await Provider.findOneAndUpdate({ phone }, { serviceDescription: body, state: 'ONBOARDING_LOCATION' });
    await client.sendMessage(
      from,
      'Please share your business location so customers can find you.\n\nTap the attachment icon and select Location.',
    );
    return;
  }

  // ONBOARDING — SERVICE TYPE
  if (state === 'ONBOARDING_SERVICE') {
    const validServices = ['food', 'hair_beauty', 'fashion', 'photography', 'home_services'];
    const service = body.toLowerCase().replace(/ /g, '_');

    let serviceType = service;
    if (body === '1') serviceType = 'food';
    else if (body === '2') serviceType = 'hair_beauty';
    else if (body === '3') serviceType = 'fashion';
    else if (body === '4') serviceType = 'photography';
    else if (body === '5') serviceType = 'home_services';

    if (!validServices.includes(serviceType)) {
      await client.sendMessage(
        from,
        'Please reply 1-5 or type one of: food, hair_beauty, fashion, photography, home_services',
      );
      return;
    }

    await Provider.findOneAndUpdate({ phone }, { serviceType, state: 'ONBOARDING_DESCRIPTION' });
    await client.sendMessage(
      from,
      'Tell us a little more about what you offer. For example: "I provide fast home barber services across Lekki and Victoria Island."',
    );
    return;
  }

  // ONBOARDING — LOCATION
  if (state === 'ONBOARDING_LOCATION') {
    if (message.type === 'location') {
      const { latitude, longitude } = message.location;
      await Provider.findOneAndUpdate(
        { phone },
        {
          location: { lat: latitude, lng: longitude },
          state: 'ONBOARDING_PRICING',
        },
      );
      await client.sendMessage(
        from,
        'Location saved! What is your price per service in NGN? For example: 2500',
      );
    } else {
      await client.sendMessage(
        from,
        'Please share your business location using the location pin. Tap the attachment icon and select Location.',
      );
    }
    return;
  }

  // ONBOARDING — PRICING
  if (state === 'ONBOARDING_PRICING') {
    const price = parseInt(body);
    if (isNaN(price) || price <= 0) {
      await client.sendMessage(
        from,
        'Please enter a valid price in NGN. For example: 2500',
      );
      return;
    }
    await Provider.findOneAndUpdate({ phone }, { price, state: 'ONBOARDING_BANK' });
    await client.sendMessage(
      from,
      'What is your bank account number and bank name? This is where we will send your payments.\n\nFormat: AccountNumber BankName\nExample: 0123456789 GTBank',
    );
    return;
  }

  // ONBOARDING — BANK DETAILS
  if (state === 'ONBOARDING_BANK') {
    const parts = body.split(/\s+/);
    if (parts.length < 2) {
      await client.sendMessage(
        from,
        'Please send your account number and bank name separated by a space.\nExample: 0123456789 GTBank',
      );
      return;
    }

    const accountNumber = parts[0];
    const bankName = parts.slice(1).join(' ');
    const bankCodeKey = bankName.toLowerCase().replace(/\s+/g, '');
    const bankCode = BANK_CODES[bankCodeKey] || null;

    if (!bankCode) {
      await client.sendMessage(
        from,
        `Bank "${bankName}" not recognized. Please send your bank code directly or try again with: GTBank, Access, Zenith, FirstBank, UBA, Fidelity, FCMB, Union, Sterling, Wema, Kuda, OPay, or PalmPay`,
      );
      return;
    }

    await Provider.findOneAndUpdate(
      { phone },
      {
        bankDetails: { accountNumber, bankName, bankCode, accountName: '' },
        state: 'ONBOARDING_AVAILABILITY',
      },
    );
    await client.sendMessage(
      from,
      'Bank details saved! What days and hours are you available?\n\nExample: Monday to Saturday, 8am to 7pm',
    );
    return;
  }

  // ONBOARDING — AVAILABILITY
  if (state === 'ONBOARDING_AVAILABILITY') {
    await Provider.findOneAndUpdate({ phone }, { availability: body, state: 'ONBOARDING_IMAGE' });
    await client.sendMessage(
      from,
      'Great. Now send a clear profile photo of yourself or your business logo. If you do not have one, reply SKIP.',
    );
    return;
  }

  // ONBOARDING — IMAGE
  if (state === 'ONBOARDING_IMAGE') {
    let profileImageUrl: string | undefined;

    if (body.toUpperCase() === 'SKIP') {
      profileImageUrl = undefined;
    } else if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (media?.data && media?.mimetype?.startsWith('image/')) {
        try {
          profileImageUrl = await uploadBase64Image(`data:${media.mimetype};base64,${media.data}`, 'fetcha/providers');
        } catch (error) {
          console.error('Provider image upload failed:', error);
          profileImageUrl = undefined;
        }
      } else {
        await client.sendMessage(from, 'Please send an image file or reply SKIP to continue.');
        return;
      }
    } else {
      await client.sendMessage(from, 'Please send an image file or reply SKIP to continue.');
      return;
    }

    await Provider.findOneAndUpdate(
      { phone },
      {
        ...(profileImageUrl ? { profileImageUrl } : {}),
        state: 'AWAITING_VERIFICATION_PAYMENT',
      },
    );

    const ref = buildSquadRef('verification', phone);
    const verificationFee = parseInt(process.env.VERIFICATION_FEE || '50000');

    const paymentData = await initiatePayment({
      phone,
      name: provider.name,
      amount: verificationFee,
      ref,
    });

    await Transaction.create({
      squadRef: ref,
      type: 'verification_fee',
      amount: verificationFee / 100,
      phone,
    });

    const checkoutUrl = paymentData.data?.checkout_url || 'https://squad.checkout.link';
    await client.sendMessage(
      from,
      `Almost done! Pay a one-time verification fee to get listed as a verified provider on Fetcha.\n\nClick the link below to pay:\n${checkoutUrl}`,
    );
    return;
  }

  // AWAITING VERIFICATION PAYMENT
  if (state === 'AWAITING_VERIFICATION_PAYMENT') {
    if (body.toUpperCase() === 'RESEND') {
      const verificationFee = parseInt(process.env.VERIFICATION_FEE || '50000');
      const ref = buildSquadRef('verification', phone);

      try {
        // Mark older pending verification links as failed so only the newest link remains active.
        await Transaction.updateMany(
          { phone, type: 'verification_fee', status: 'pending' },
          { status: 'failed' },
        );

        const paymentData = await initiatePayment({
          phone,
          name: provider.name,
          amount: verificationFee,
          ref,
        });

        await Transaction.create({
          squadRef: ref,
          type: 'verification_fee',
          amount: verificationFee / 100,
          phone,
        });

        const checkoutUrl = paymentData.data?.checkout_url || 'https://squad.checkout.link';
        await client.sendMessage(from, `Here is your new payment link:\n${checkoutUrl}`);
      } catch (error: any) {
        console.error('Verification payment resend failed:', error?.response?.data || error?.message || error);
        await client.sendMessage(
          from,
          'Sorry, I could not generate a new payment link right now. Please try RESEND again in a moment.',
        );
      }
    } else {
      await client.sendMessage(
        from,
        'Please complete your verification payment using the link we sent. Reply RESEND if you need a new link.',
      );
    }
    return;
  }

  // ACTIVE — provider receives notifications, no input needed here
  if (state === 'ACTIVE') {
    await client.sendMessage(
      from,
      'You are live on Fetcha! You will be notified when customers book you. Reply with any questions.',
    );
    return;
  }
};

export default { handleProvider };
