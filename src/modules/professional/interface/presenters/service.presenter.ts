import type { MediaStoragePort } from '../../../media/media-storage.port';
import type {
  CommuneFeeVO,
  ServiceOfferingEntity,
} from '../../core/entities/service-offering.entity';

/**
 * Image variant sizes served to clients.
 * - thumb: lists / grids (smallest payload)
 * - card:  cards / detail header
 * - original (imageUrl): full-screen / zoom
 */
const THUMB_WIDTH = 200;
const CARD_WIDTH = 600;

/**
 * Serialized service payload returned to clients: the data fields of a
 * ServiceOfferingEntity (no domain methods) plus derived image variants.
 */
export type ServiceResponse = {
  id: string;
  professionalId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imageThumbUrl: string | null;
  imageCardUrl: string | null;
  durationMin: number;
  basePrice: number;
  category: string;
  isActive: boolean;
  communeFees: CommuneFeeVO[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

/**
 * Enrich a service entity with resized/compressed image variants derived
 * from its stored `imageUrl`. The original `imageUrl` is preserved as-is.
 */
export function presentService(
  media: MediaStoragePort,
  service: ServiceOfferingEntity,
): ServiceResponse {
  return {
    ...service,
    imageThumbUrl: media.buildPreviewUrl(service.imageUrl, {
      width: THUMB_WIDTH,
      quality: 70,
    }),
    imageCardUrl: media.buildPreviewUrl(service.imageUrl, {
      width: CARD_WIDTH,
      quality: 75,
    }),
  };
}

export function presentServices(
  media: MediaStoragePort,
  services: ServiceOfferingEntity[],
): ServiceResponse[] {
  return services.map((service) => presentService(media, service));
}
