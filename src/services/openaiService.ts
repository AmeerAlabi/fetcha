import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SERVICE_TYPES = ['food', 'hair_beauty', 'fashion', 'photography', 'home_services', 'other'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

const normalizeServiceType = (value?: string | null): ServiceType => {
  const service = String(value || '').toLowerCase().trim();

  if (['barber', 'barbing', 'hair', 'haircut', 'salon', 'braids', 'hair_beauty'].includes(service)) {
    return 'hair_beauty';
  }

  if (['tailor', 'tailoring', 'fashion', 'sewing', 'designer'].includes(service)) {
    return 'fashion';
  }

  if (['food', 'bukka', 'restaurant', 'catering', 'chef'].includes(service)) {
    return 'food';
  }

  if (['photo', 'photography', 'photographer', 'videography'].includes(service)) {
    return 'photography';
  }

  if (['home', 'home_services', 'plumber', 'electrician', 'mechanic', 'cleaning', 'repairs'].includes(service)) {
    return 'home_services';
  }

  return service as ServiceType;
};

const extractLocalIntent = (message: string): { serviceType: ServiceType; locationHint: string | null } => {
  const text = message.toLowerCase().trim();

  const locationMatch = text.match(/(?:near|around|in|at|close to)\s+([a-z0-9\s'-]{2,40})/i);
  const locationHint = locationMatch?.[1]?.trim() || null;

  if (/(barber|barbing|haircut|salon|braids|hair)/i.test(text)) {
    return { serviceType: 'hair_beauty', locationHint };
  }

  if (/(tailor|tailoring|fashion|sewing|designer)/i.test(text)) {
    return { serviceType: 'fashion', locationHint };
  }

  if (/(bukka|food|restaurant|catering|chef|eat|meal|rice|snack)/i.test(text)) {
    return { serviceType: 'food', locationHint };
  }

  if (/(photo|photographer|photography|videography|camera)/i.test(text)) {
    return { serviceType: 'photography', locationHint };
  }

  if (/(plumb|electrician|mechanic|cleaning|repairs|home|maintenance)/i.test(text)) {
    return { serviceType: 'home_services', locationHint };
  }

  return { serviceType: 'other', locationHint };
};

export const extractIntent = async (
  message: string,
): Promise<{ serviceType: ServiceType; locationHint: string | null }> => {
  console.log('[extractIntent] Starting intent extraction for message:', message);
  const localIntent = extractLocalIntent(message);
  console.log('[extractIntent] Local fallback intent:', localIntent);

  const prompt = `
You are an assistant for a Nigerian local services app called Fetcha.
A customer just sent this message: "${message}"

Extract the following from the message:
1. serviceType: the type of service they need. Map it to one of these categories exactly:
   food, hair_beauty, fashion, photography, home_services, other
  Treat common Nigerian synonyms as follows:
  barber/hair/salon/braids/haircut -> hair_beauty
  tailor/fashion/sewing/designer -> fashion
  bukka/restaurant/catering/chef -> food
  photo/photographer/videography -> photography
  plumber/electrician/mechanic/cleaning/repairs -> home_services
2. locationHint: any location or area they mentioned.
   Return null if they did not mention a location.

Respond ONLY with a valid JSON object. No explanation. No markdown.
Example:
{"serviceType":"hair_beauty","locationHint":"Lekki"}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    console.log('[extractIntent] OpenAI response:', text);
    try {
      const parsed = JSON.parse(text) as { serviceType?: ServiceType; locationHint?: string | null };
      const normalized = {
        serviceType: normalizeServiceType(parsed.serviceType) || localIntent.serviceType,
        locationHint: parsed.locationHint ?? localIntent.locationHint,
      };
      console.log('[extractIntent] Normalized result:', normalized);
      return normalized;
    } catch (parseError) {
      console.warn('[extractIntent] JSON parse failed, using local fallback:', parseError);
      return localIntent;
    }
  } catch (openaiError) {
    console.error('[extractIntent] OpenAI API error, using local fallback:', openaiError);
    return localIntent;
  }
};