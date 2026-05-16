import Provider, { ProviderDocument } from '../models/Provider';
import { haversineDistance } from '../utils/haversine';

export interface NearbyProvider extends ProviderDocument {
  distance: number;
}

export const findNearbyProviders = async ({
  lat,
  lng,
  serviceType,
  limit = 3,
}: {
  lat: number;
  lng: number;
  serviceType: string;
  limit?: number;
}): Promise<NearbyProvider[]> => {
  console.log(`[findNearbyProviders] Searching for serviceType="${serviceType}" at (${lat}, ${lng})`);
  const providers = await Provider.find({
    serviceType,
    verified: true,
    suspended: false,
  });
  console.log(`[findNearbyProviders] Query returned ${providers.length} providers for serviceType="${serviceType}"`);

  if (!providers.length) {
    console.log(`[findNearbyProviders] No verified providers found for serviceType="${serviceType}"`);
    return [];
  }

  const withDistance = providers
    .filter((provider) => provider.location?.lat !== undefined && provider.location?.lng !== undefined)
    .map((provider) => ({
      ...(provider.toObject() as ProviderDocument),
      distance: haversineDistance(lat, lng, provider.location!.lat!, provider.location!.lng!),
    }));

  withDistance.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return b.trustScore - a.trustScore;
  });

  const results = withDistance.slice(0, limit);
  console.log(`[findNearbyProviders] Returning ${results.length} results (top ${limit})`);
  results.forEach((p, i) => {
    console.log(`[findNearbyProviders] [${i + 1}] ${p.name} - ${p.distance.toFixed(2)}km away, trust=${p.trustScore}`);
  });
  return results;
};
