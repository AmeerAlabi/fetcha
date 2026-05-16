/**
 * Format a phone number from WhatsApp JID format to readable E.164 or local format.
 * Examples:
 *   '236360891949056' -> '+2349041622162' (if stored in WhatsApp JID format)
 *   '9041622162' -> '+2349041622162' (if stored as local number without country code)
 *   '+2349041622162' -> '+2349041622162' (already formatted)
 */
export const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';

  // Remove any @ suffix (e.g., @c.us, @lid, @g.us)
  let cleaned = phone.split('@')[0].trim();

  // If it already starts with +, return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Detect Nigerian numbers (starts with 234 or 0)
  if (cleaned.startsWith('234')) {
    // Already in WhatsApp JID format: 234<number>
    // Format as +234 <number>
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Local Nigerian format: 0<number> (11 digits total)
    // Convert to +234<number>
    return `+234${cleaned.substring(1)}`;
  }

  // For any other format, prepend + if it doesn't have it
  if (!cleaned.startsWith('+') && /^\d+$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
};

/**
 * Convert a display phone number (E.164 or local) to WhatsApp JID format.
 * Examples:
 *   '+2349041622162' -> '2349041622162@lid'
 *   '09041622162' -> '2349041622162@lid'
 */
export const formatPhoneForWhatsApp = (phone: string, format: 'c.us' | 'lid' = 'c.us'): string => {
  if (!phone) return '';

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Detect and normalize to 234<number> format
  let jidPhone = digitsOnly;

  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    // Local format: 0<number> -> 234<number>
    jidPhone = `234${digitsOnly.substring(1)}`;
  } else if (digitsOnly.length === 10 && !digitsOnly.startsWith('234')) {
    // Just the number part without country code: <number> -> 234<number>
    jidPhone = `234${digitsOnly}`;
  }

  return `${jidPhone}@${format}`;
};

export const normalizePhoneInput = (phone: string): string => {
  if (!phone) return '';

  const trimmed = phone.trim();
  if (!/^[+\d][\d\s()-]*$/.test(trimmed)) {
    return '';
  }

  return formatPhoneForDisplay(trimmed);
};
