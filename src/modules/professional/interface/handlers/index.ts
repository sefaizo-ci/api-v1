import {
  RemoveAvailabilityHandler,
  SetAvailabilityForAllWeekHandler,
  SetAvailabilityHandler,
  SetAvailabilityStatusHandler,
  UpdateAvailabilityHandler,
} from './availability.handlers';
import {
  CancelBookingHandler,
  CompleteBookingHandler,
  ConfirmBookingHandler,
  RejectBookingHandler,
} from './booking.handlers';
import {
  DeleteGalleryItemHandler,
  PublishGalleryItemHandler,
  ReorderGalleryHandler,
  UnpublishGalleryItemHandler,
  UpdateGalleryItemHandler,
  UploadGalleryItemHandler,
} from './gallery.handlers';
import {
  GetMyProfessionalProfileHandler,
  GetProfessionalAvailabilityHandler,
  GetProfessionalBookingsHandler,
  GetProfessionalGalleryHandler,
  GetProfessionalProfileHandler,
  GetProfessionalServicesHandler,
  GetProfileCompletionHandler,
  ListProfessionalsHandler,
  ListServiceCategoriesHandler,
  SearchProfessionalsHandler,
} from './professional.query.handlers';
import {
  CreateProfessionalProfileHandler,
  ReactivateProfessionalHandler,
  SuspendProfessionalHandler,
  UpdateProfessionalProfileHandler,
  VerifyProfessionalHandler,
} from './profile.handlers';
import {
  ActivateServiceHandler,
  AddServiceHandler,
  CreateServiceCategoryHandler,
  DeactivateServiceHandler,
  DeleteServiceCategoryHandler,
  DeleteServiceHandler,
  SetServiceCommuneFeeHandler,
  UpdateServiceCategoryHandler,
  UpdateServiceHandler,
} from './service.handlers';

export const ProfessionalCommandHandlers = [
  CreateProfessionalProfileHandler,
  UpdateProfessionalProfileHandler,
  VerifyProfessionalHandler,
  SuspendProfessionalHandler,
  ReactivateProfessionalHandler,
  CreateServiceCategoryHandler,
  UpdateServiceCategoryHandler,
  DeleteServiceCategoryHandler,
  AddServiceHandler,
  UpdateServiceHandler,
  DeleteServiceHandler,
  SetServiceCommuneFeeHandler,
  ActivateServiceHandler,
  DeactivateServiceHandler,
  SetAvailabilityHandler,
  UpdateAvailabilityHandler,
  RemoveAvailabilityHandler,
  SetAvailabilityStatusHandler,
  SetAvailabilityForAllWeekHandler,
  UploadGalleryItemHandler,
  UpdateGalleryItemHandler,
  DeleteGalleryItemHandler,
  PublishGalleryItemHandler,
  UnpublishGalleryItemHandler,
  ReorderGalleryHandler,
  ConfirmBookingHandler,
  RejectBookingHandler,
  CompleteBookingHandler,
  CancelBookingHandler,
];

export const ProfessionalQueryHandlers = [
  GetMyProfessionalProfileHandler,
  GetProfessionalProfileHandler,
  ListProfessionalsHandler,
  GetProfessionalServicesHandler,
  GetProfessionalAvailabilityHandler,
  GetProfessionalGalleryHandler,
  GetProfessionalBookingsHandler,
  GetProfileCompletionHandler,
  ListServiceCategoriesHandler,
  SearchProfessionalsHandler,
];

export * from './availability.handlers';
export * from './booking.handlers';
export * from './gallery.handlers';
export * from './professional.query.handlers';
export * from './profile.handlers';
export * from './service.handlers';
