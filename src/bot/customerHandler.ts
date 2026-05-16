import Customer, { CustomerDocument } from '../models/Customer';
import Provider from '../models/Provider';
import Booking from '../models/Booking';
import Transaction from '../models/Transaction';
import { extractIntent } from '../services/openaiService';
import { findNearbyProviders } from '../services/locationService';
import { initiatePayment, fundTransfer } from '../services/squadService';
import { formatPhoneForWhatsApp, normalizePhoneInput } from '../utils/phoneFormatter';
import { buildSquadRef } from '../utils/squadRef';

export const handleCustomer = async (
  client: any,
  message: any,
  customer: CustomerDocument,
  phone: string,
  body: string,
) => {
  const state = customer.state;
  const from = message.from;
  const displayPhone = customer.contactPhone || phone;

  // CONFIRMING PHONE
  if (state === 'CONFIRMING_PHONE') {
    if (body.toUpperCase() === 'YES' || body === '1' || body === '2') {
      if (body === '1') {
        await Customer.findOneAndUpdate({ phone }, { contactPhone: displayPhone, state: 'ONBOARDING_NAME' });
        await client.sendMessage(from, 'Great! What is your name?');
      } else if (body === '2') {
        await Customer.findOneAndDelete({ phone });
        await Provider.create({ phone, contactPhone: displayPhone, state: 'ONBOARDING_NAME' });
        await client.sendMessage(from, 'Welcome, provider! What is your name?');
      } else {
        await Customer.findOneAndUpdate({ phone }, { contactPhone: displayPhone, state: 'SELECTING_ROLE' });
        await client.sendMessage(from, 'Great. Are you a:\n1. Customer\n2. Service Provider\n\nReply 1 or 2');
      }
      return;
    }

    const alternatePhone = normalizePhoneInput(body);
    if (!alternatePhone) {
      await client.sendMessage(
        from,
        `Please reply YES to use ${displayPhone}, or send another phone number to replace it. Then reply 1 for Customer or 2 for Service Provider.`,
      );
      return;
    }

    await Customer.findOneAndUpdate({ phone }, { contactPhone: alternatePhone, state: 'SELECTING_ROLE' });
    await client.sendMessage(
      from,
      `Saved. We will use ${alternatePhone}. Are you a:\n1. Customer\n2. Service Provider\n\nReply 1 or 2`,
    );
    return;
  }

  // SELECTING ROLE
  if (state === 'SELECTING_ROLE') {
    if (body === '1') {
      await Customer.findOneAndUpdate({ phone }, { state: 'ONBOARDING_NAME' });
      await client.sendMessage(from, 'Great! What is your name?');
    } else if (body === '2') {
      // Switch to provider flow
      await Customer.findOneAndDelete({ phone });
      await Provider.create({ phone, contactPhone: displayPhone, state: 'ONBOARDING_NAME' });
      await client.sendMessage(from, 'Welcome, provider! What is your name?');
    } else {
      await client.sendMessage(from, 'Please reply 1 for Customer or 2 for Service Provider.');
    }
    return;
  }

  // ONBOARDING — NAME
  if (state === 'ONBOARDING_NAME') {
    await Customer.findOneAndUpdate({ phone }, { name: body, state: 'ONBOARDING_LOCATION' });
    await client.sendMessage(
      from,
      `Nice to meet you, ${body}! Please share your location so we can find services near you.\n\nTap the attachment icon and select Location.`,
    );
    return;
  }

  // ONBOARDING — LOCATION
  if (state === 'ONBOARDING_LOCATION') {
    if (message.type === 'location') {
      const { latitude, longitude } = message.location;
      await Customer.findOneAndUpdate(
        { phone },
        {
          location: { lat: latitude, lng: longitude },
          state: 'SEARCHING',
        },
      );
      await client.sendMessage(
        from,
        'Location saved! What service are you looking for? For example: barber, tailor, bukka, photographer, plumber.',
      );
    } else {
      await client.sendMessage(
        from,
        'Please share your location using the location pin. Tap the attachment icon and select Location.',
      );
    }
    return;
  }

  // SEARCHING
  if (state === 'SEARCHING') {
    console.log(`[SEARCHING] User ${phone} searching with message: "${body}"`);
    await client.sendMessage(from, 'Searching for providers near you...');

    let intent;
    try {
      intent = await extractIntent(body);
      console.log(`[SEARCHING] Extracted intent for ${phone}:`, intent);
    } catch (error) {
      console.error(`[SEARCHING] extractIntent failed for ${phone}:`, error);
      await client.sendMessage(
        from,
        'I could not understand that. Please try again, for example: "I need a barber" or "find me a bukka".',
      );
      return;
    }

    const updatedCustomer = await Customer.findOne({ phone });
    if (!updatedCustomer || !updatedCustomer.location?.lat || !updatedCustomer.location?.lng) {
      console.warn(`[SEARCHING] No location found for ${phone}`);
      await client.sendMessage(from, 'We need your location to find services. Please share it again.');
      await Customer.findOneAndUpdate({ phone }, { state: 'ONBOARDING_LOCATION' });
      return;
    }

    console.log(`[SEARCHING] Location for ${phone}:`, updatedCustomer.location);
    const providers = await findNearbyProviders({
      lat: updatedCustomer.location.lat,
      lng: updatedCustomer.location.lng,
      serviceType: intent.serviceType,
    });
    console.log(`[SEARCHING] Found ${providers.length} providers for serviceType "${intent.serviceType}" for ${phone}`);

    if (!providers.length) {
      if (intent.serviceType === 'other') {
        console.log(`[SEARCHING] serviceType is 'other', asking user to clarify for ${phone}`);
        await client.sendMessage(
          from,
          'I could not clearly identify the service you need. Please try again with something like barber, tailor, food, photographer, or plumber.',
        );
        return;
      }

      console.log(`[SEARCHING] No providers found for serviceType "${intent.serviceType}" for ${phone}`);
      await client.sendMessage(
        from,
        'I couldn\'t find any verified providers for that service in your area right now. I can keep looking — please try again later or try a nearby service.',
      );
      return;
    }

    // Save search results to customer record
    await Customer.findOneAndUpdate({ phone }, {
      searchResults: providers.map((p) => p._id),
      state: 'AWAITING_PROVIDER_SELECTION',
    });

    // Format and send results
    let resultsMessage = 'Here is what I found near you\n\n';
    providers.forEach((p, i) => {
      const rating = p.ratingCount > 0 ? `⭐${p.trustScore}` : '⭐New';
      resultsMessage += `${i + 1}. ${p.name} — ${p.distance}km away  ${rating}\n   Service: ${p.serviceType}\n   Price: NGN ${p.price || 'TBD'}\n\n`;
    });
    resultsMessage += 'Reply 1, 2 or 3 to book.';
    await client.sendMessage(from, resultsMessage);
    return;
  }

  // PROVIDER SELECTION
  if (state === 'AWAITING_PROVIDER_SELECTION') {
    const index = parseInt(body) - 1;
    if (isNaN(index) || index < 0 || index > 2) {
      await client.sendMessage(from, 'Please reply with 1, 2 or 3 to select a provider.');
      return;
    }

    const updatedCustomer = await Customer.findOne({ phone });
    if (!updatedCustomer?.searchResults[index]) {
      await client.sendMessage(from, 'Something went wrong. Please search again.');
      return;
    }

    const providerId = updatedCustomer.searchResults[index];
    const provider = await Provider.findById(providerId);

    if (!provider) {
      await client.sendMessage(from, 'Something went wrong. Please search again.');
      return;
    }

    // Create a pending booking
    const bookingAmount = provider.price || 2000;
    const booking = await Booking.create({
      customerId: customer._id,
      providerId: provider._id,
      customerPhone: phone,
      customerContactPhone: customer.contactPhone || phone,
      providerPhone: provider.phone,
      providerContactPhone: provider.contactPhone || provider.phone,
      serviceType: provider.serviceType,
      amount: bookingAmount,
      status: 'pending',
    });

    // Generate Squad payment link
    const ref = buildSquadRef('booking', booking._id.toString());
    const amountInKobo = bookingAmount * 100;
    const paymentData = await initiatePayment({
      phone,
      name: updatedCustomer.name,
      amount: amountInKobo,
      ref,
    });

    // Save Squad ref to booking
    await Booking.findByIdAndUpdate(booking._id, { squadPaymentRef: ref });
    await Transaction.create({
      squadRef: ref,
      type: 'booking_payment',
      amount: bookingAmount,
      phone,
      relatedId: booking._id,
    });
    await Customer.findOneAndUpdate({ phone }, {
      state: 'AWAITING_BOOKING_PAYMENT',
      currentBookingId: booking._id,
    });

    const checkoutUrl = paymentData.data?.checkout_url || 'https://squad.checkout.link';
    await client.sendMessage(
      from,
      `Great choice!\n\nProvider: ${provider.name}\nService: ${provider.serviceType}\nPrice: NGN ${bookingAmount}\n\nClick the link below to pay and confirm your booking:\n${checkoutUrl}`,
    );
    return;
  }

  // AWAITING BOOKING PAYMENT
  if (state === 'AWAITING_BOOKING_PAYMENT') {
    if (body.toUpperCase() === 'RESEND') {
      const booking = await Booking.findById(customer.currentBookingId);
      if (booking) {
        const ref = buildSquadRef('booking', booking._id.toString());
        const bookingAmount = booking.amount || 2000;
        const paymentData = await initiatePayment({
          phone,
          name: customer.name,
          amount: bookingAmount * 100,
          ref,
        });
        const checkoutUrl = paymentData.data?.checkout_url || 'https://squad.checkout.link';
        await client.sendMessage(from, `Here is your new payment link:\n${checkoutUrl}`);
      }
    } else {
      await client.sendMessage(
        from,
        'Please complete your payment using the link we sent. If you need a new link, reply RESEND.',
      );
    }
    return;
  }

  // AWAITING CONFIRMATION
  if (state === 'AWAITING_CONFIRMATION') {
    if (body.toUpperCase() === 'YES') {
      const booking = await Booking.findById(customer.currentBookingId).populate('providerId');
      if (!booking || !booking.providerId) {
        await client.sendMessage(from, 'Booking not found. Please search again.');
        return;
      }

      const provider = booking.providerId as any;
      const bookingAmount = booking.amount || 2000;
      const payoutRef = buildSquadRef('payout', booking._id.toString());

      try {
        await Booking.findByIdAndUpdate(booking._id, {
          status: 'completed',
          squadPayoutRef: payoutRef,
        });
        await Transaction.create({
          squadRef: payoutRef,
          type: 'payout',
          amount: bookingAmount,
          phone: provider.phone,
          relatedId: booking._id,
          status: 'pending',
        });

        await fundTransfer({
          accountNumber: provider.bankDetails?.accountNumber || '',
          bankCode: provider.bankDetails?.bankCode || '',
          accountName: provider.bankDetails?.accountName || provider.name || '',
          amount: bookingAmount * 100,
          remark: `Fetcha payout for booking ${booking._id}`,
          ref: payoutRef,
        });

        await Transaction.findOneAndUpdate({ squadRef: payoutRef }, { status: 'success' });
        await Customer.findOneAndUpdate({ phone }, { state: 'RATING' });

        const customerPhoneForMessage = booking.customerPhone || phone;
        await client.sendMessage(
          from,
          'Thank you for confirming! Please rate your experience from 1 to 5.\n\n5 = Excellent\n4 = Very Good\n3 = Good\n2 = Fair\n1 = Poor',
        );
        await client.sendMessage(
          formatPhoneForWhatsApp(provider.contactPhone || provider.phone, 'lid'),
          `Your payout has been sent for booking ${booking._id}. If you need to follow up, contact the customer at ${customerPhoneForMessage}.`,
        );
      } catch (error) {
        console.error('Payout error:', error);
        await Transaction.findOneAndUpdate({ squadRef: payoutRef }, { status: 'failed' });
        const customerPhoneForMessage = booking.customerPhone || phone;
        await Customer.findOneAndUpdate({ phone }, { state: 'RATING' });
        await client.sendMessage(
          from,
          'The booking is confirmed, but automatic payout is not available in this Squad sandbox right now. We have saved the completion and will process settlement manually.',
        );
        await client.sendMessage(
          formatPhoneForWhatsApp(provider.contactPhone || provider.phone, 'lid'),
          `The customer confirmed completion for booking ${booking._id}. Your payout is queued for manual settlement because the sandbox payout endpoint is restricted. Customer contact: ${customerPhoneForMessage}.`,
        );
      }
    } else if (body.toUpperCase() === 'NO') {
      await Booking.findByIdAndUpdate(customer.currentBookingId, { status: 'disputed' });
      await Customer.findOneAndUpdate({ phone }, { state: 'SEARCHING' });
      await client.sendMessage(
        from,
        'We have logged your dispute. Our team will reach out to you shortly to resolve this.',
      );
    } else {
      await client.sendMessage(from, 'Please reply YES if the service was completed or NO to raise an issue.');
    }
    return;
  }

  // RATING
  if (state === 'RATING') {
    const rating = parseInt(body);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await client.sendMessage(from, 'Please reply with a number from 1 to 5.');
      return;
    }

    const booking = await Booking.findById(customer.currentBookingId);
    if (!booking) {
      await client.sendMessage(from, 'Booking not found. Please search again.');
      return;
    }

    await Booking.findByIdAndUpdate(booking._id, { rating });

    // Update provider trust score
    const provider = await Provider.findById(booking.providerId);
    if (provider) {
      const newTotal = provider.totalRatings + rating;
      const newCount = provider.ratingCount + 1;
      const newScore = parseFloat((newTotal / newCount).toFixed(1));

      await Provider.findByIdAndUpdate(provider._id, {
        totalRatings: newTotal,
        ratingCount: newCount,
        trustScore: newScore,
        completedBookings: provider.completedBookings + 1,
      });
    }

    await Customer.findOneAndUpdate({ phone }, { state: 'SEARCHING', currentBookingId: null });
    await client.sendMessage(
      from,
      `Thank you for rating! You gave ${rating}/5. What else can we help you with? Just tell us what service you need.`,
    );
    return;
  }
};

export default { handleCustomer };
