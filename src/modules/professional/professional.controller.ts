import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../libs/exceptions/domain.exceptions';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Public } from '../../libs/decorators/public.decorator';
import { Roles } from '../../libs/decorators/roles.decorator';
import type { MediaStoragePort } from '../media/media-storage.port';
import { MEDIA_STORAGE_SERVICE } from '../media/media-storage.port';
import { RolesGuard } from '../sentinel/infrastructure/guards/roles.guard';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  CompleteBookingCommand,
  ConfirmBookingCommand,
  CreateProfessionalProfileCommand,
  CreateServiceCategoryRequestCommand,
  PauseBookingsCommand,
  ResubmitProfessionalCommand,
  ResumeBookingsCommand,
  ToggleListingCommand,
  DeactivateServiceCommand,
  DeleteGalleryItemCommand,
  DeleteServiceCommand,
  PublishGalleryItemCommand,
  RejectBookingCommand,
  RemoveAvailabilityCommand,
  RemoveAvatarCommand,
  RemoveServiceImageCommand,
  ReplaceGalleryCommand,
  ReorderGalleryCommand,
  SetAvailabilityBulkCommand,
  SetAvailabilityCommand,
  SetAvailabilityForAllWeekCommand,
  SetAvailabilityStatusCommand,
  SetServiceCommuneFeeCommand,
  UnpublishGalleryItemCommand,
  UpdateAvailabilityCommand,
  UpdateGalleryItemCommand,
  UpdateProfessionalProfileCommand,
  UpdateServiceCommand,
  UploadGalleryItemCommand,
  UpsertServicesBulkCommand,
} from './interface/commands';
import {
  ApproveBookingCancellationRequestCommand,
  CancelBookingCommand,
  MarkNoShowCommand,
  RejectBookingCancellationRequestCommand,
} from './interface/commands/booking.commands';
import { UpdateProfessionalSettingsCommand } from './interface/commands/profile.commands';
import {
  AddServiceDto,
  CreateProfessionalProfileDto,
  CreateServiceCategoryRequestDto,
  RejectBookingDto,
  ReplaceGalleryDto,
  ReviewCancellationRequestDto,
  SetAvailabilityBulkDto,
  SetAvailabilityDto,
  SetAvailabilityForWeekDto,
  SetAvailabilityStatusDto,
  SetCommuneFeeDto,
  UpdateAvailabilityDto,
  UpdateGalleryItemDto,
  UpdateProfessionalProfileDto,
  UpdateServiceDto,
  UploadGalleryItemDto,
  UpsertServicesBulkDto,
} from './interface/dtos';
import {
  SuspendProfessionalDto,
  UpdateProfessionalSettingsDto,
} from './interface/dtos/profile.dto';
import { ReorderGalleryDto } from './interface/dtos/gallery.dto';
import {
  GetAvailableSlotsQuery,
  GetMyOnboardingStateQuery,
  GetMyProfessionalProfileQuery,
  GetNewProfessionalsQuery,
  GetProfessionalDashboardQuery,
  GetProfessionalAvailabilityQuery,
  GetProfessionalBookingsCalendarQuery,
  GetProfessionalBookingsQuery,
  GetProfessionalGalleryQuery,
  GetProfessionalProfileQuery,
  GetProfessionalRevenueSummaryQuery,
  GetProfessionalServicesQuery,
  GetProfileCompletionQuery,
  GetRecommendedProfessionalsQuery,
  GetTrendingProfessionalsQuery,
  ListProfessionalsQuery,
  ListServiceCategoriesQuery,
  ListServiceCategoryRequestsQuery,
  SearchProfessionalsQuery,
} from './interface/queries';
import { ListBookingCancellationRequestsQuery } from './interface/queries/professional.queries';

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 15;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller('professionals')
export class ProfessionalController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly mediaStorageService: MediaStoragePort,
  ) {}

  /**
   * Create professional profile
   * Constraint: one user can only create one profile
   */
  @Post('profile')
  @UseGuards(RolesGuard)
  @Roles('CLIENT', 'PROFESSIONAL')
  async createProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateProfessionalProfileDto,
  ) {
    return this.commandBus.execute<CreateProfessionalProfileCommand, unknown>(
      new CreateProfessionalProfileCommand(
        req.user.id,
        body.agencyName,
        body.bio,
        body.location,
        body.address,
        body.latitude,
        body.longitude,
        body.amenities,
        body.mainCategories,
      ),
    );
  }

  /**
   * Toggle public listing visibility (pro-controlled)
   */
  @Put('profile/:professionalId/listing')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async toggleListing(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body('active') active: boolean,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<ToggleListingCommand, unknown>(
      new ToggleListingCommand(professionalId, active),
    );
  }

  /**
   * Pause new bookings — body: { resumeAt?: string (ISO date) }
   */
  @Put('profile/:professionalId/bookings/pause')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async pauseBookings(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body('resumeAt') resumeAt?: string,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<PauseBookingsCommand, unknown>(
      new PauseBookingsCommand(
        professionalId,
        resumeAt ? new Date(resumeAt) : undefined,
      ),
    );
  }

  /**
   * Resume bookings immediately
   */
  @Put('profile/:professionalId/bookings/resume')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async resumeBookings(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<ResumeBookingsCommand, unknown>(
      new ResumeBookingsCommand(professionalId),
    );
  }

  /**
   * Re-submit after rejection — resets status to PENDING for re-review
   */
  @Put('profile/:professionalId/resubmit')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async resubmitProfile(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<ResubmitProfessionalCommand, unknown>(
      new ResubmitProfessionalCommand(professionalId),
    );
  }

  /**
   * Update my profile
   */
  @Put('profile/:professionalId')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async updateProfile(
    @Param('professionalId') professionalId: string,
    @Body() body: UpdateProfessionalProfileDto,
  ) {
    return this.commandBus.execute<UpdateProfessionalProfileCommand, unknown>(
      new UpdateProfessionalProfileCommand(
        professionalId,
        body.agencyName,
        body.bio,
        undefined,
        body.location,
        body.address,
        body.latitude,
        body.longitude,
        body.amenities,
        body.mainCategories,
      ),
    );
  }

  /**
   * Get my professional profile
   */
  @Get('profile/me')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetMyProfessionalProfileQuery, unknown>(
      new GetMyProfessionalProfileQuery(req.user.id),
    );
  }

  /**
   * Get full onboarding state snapshot (profile + services + availabilities + gallery).
   * Called once after login when onboarding is incomplete, to restore all section data.
   */
  @Get('profile/me/onboarding-state')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyOnboardingState(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetMyOnboardingStateQuery, unknown>(
      new GetMyOnboardingStateQuery(req.user.id),
    );
  }

  /**
   * Get dashboard aggregation for the pro home page
   */
  @Get('me/dashboard')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyDashboard(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetProfessionalDashboardQuery, unknown>(
      new GetProfessionalDashboardQuery(req.user.id),
    );
  }

  /**
   * Get my revenue summary for the mobile widget
   */
  @Get('revenue/summary')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyRevenueSummary(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetProfessionalRevenueSummaryQuery, unknown>(
      new GetProfessionalRevenueSummaryQuery(req.user.id),
    );
  }

  /**
   * Get profile completion
   */
  @Get('profile/:professionalId/completion')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async getProfileCompletion(@Param('professionalId') professionalId: string) {
    return this.queryBus.execute<GetProfileCompletionQuery, unknown>(
      new GetProfileCompletionQuery(professionalId),
    );
  }

  /**
   * Get professional public profile
   */
  @Get(':professionalId')
  @Public()
  async getProfessionalProfile(
    @Param('professionalId') professionalId: string,
  ) {
    return this.queryBus.execute<GetProfessionalProfileQuery, unknown>(
      new GetProfessionalProfileQuery(professionalId),
    );
  }

  /**
   * List professionals
   */
  @Get()
  @Public()
  async listProfessionals(
    @Query('status') status?: string,
    @Query('isVerified') isVerified?: string,
    @Query('location') location?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const filters = {
      status,
      isVerified:
        isVerified === 'true'
          ? true
          : isVerified === 'false'
            ? false
            : undefined,
      location,
    };

    return this.queryBus.execute<ListProfessionalsQuery, unknown>(
      new ListProfessionalsQuery(filters, page, limit),
    );
  }

  /**
   * Search professionals
   */
  @Get('search/query')
  @Public()
  async searchProfessionals(
    @Query('q') q: string,
    @Query('location') location?: string,
    @Query('rating') rating?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<SearchProfessionalsQuery, unknown>(
      new SearchProfessionalsQuery(q, location, rating, page, limit),
    );
  }

  /**
   * Recommended professionals — top rated, optionally near user
   * ?lat=5.37&lng=-3.97&radius=10&commune=Cocody&limit=10
   */
  @Get('discover/recommended')
  @Public()
  async getRecommended(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('commune') commune?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.queryBus.execute<GetRecommendedProfessionalsQuery, unknown>(
      new GetRecommendedProfessionalsQuery(
        lat ? parseFloat(lat) : undefined,
        lng ? parseFloat(lng) : undefined,
        radius ? parseFloat(radius) : undefined,
        commune,
        limit ? parseInt(limit, 10) : undefined,
        page ? parseInt(page, 10) : undefined,
      ),
    );
  }

  /**
   * New professionals — joined in the last 30 days, optionally near user
   */
  @Get('discover/new')
  @Public()
  async getNew(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('commune') commune?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.queryBus.execute<GetNewProfessionalsQuery, unknown>(
      new GetNewProfessionalsQuery(
        lat ? parseFloat(lat) : undefined,
        lng ? parseFloat(lng) : undefined,
        radius ? parseFloat(radius) : undefined,
        commune,
        limit ? parseInt(limit, 10) : undefined,
        page ? parseInt(page, 10) : undefined,
      ),
    );
  }

  /**
   * Trending professionals — most booked, optionally near user
   */
  @Get('discover/trending')
  @Public()
  async getTrending(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('commune') commune?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.queryBus.execute<GetTrendingProfessionalsQuery, unknown>(
      new GetTrendingProfessionalsQuery(
        lat ? parseFloat(lat) : undefined,
        lng ? parseFloat(lng) : undefined,
        radius ? parseFloat(radius) : undefined,
        commune,
        limit ? parseInt(limit, 10) : undefined,
        page ? parseInt(page, 10) : undefined,
      ),
    );
  }

  @Get('services/categories')
  @Public()
  async listServiceCategories(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.queryBus.execute<ListServiceCategoriesQuery, unknown>(
      new ListServiceCategoriesQuery(page, limit),
    );
  }

  @Post(':professionalId/services/category-requests')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async createServiceCategoryRequest(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateServiceCategoryRequestDto,
  ) {
    return this.commandBus.execute<
      CreateServiceCategoryRequestCommand,
      unknown
    >(
      new CreateServiceCategoryRequestCommand(
        professionalId,
        body.proposedName,
        body.proposedDescription,
        req.user.id,
      ),
    );
  }

  @Get(':professionalId/services/category-requests')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async listProfessionalServiceCategoryRequests(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<ListServiceCategoryRequestsQuery, unknown>(
      new ListServiceCategoryRequestsQuery(
        professionalId,
        status,
        page,
        limit,
        req.user.id,
      ),
    );
  }

  /**
   * Get professional services
   */
  @Get(':professionalId/services')
  @Public()
  async getProfessionalServices(
    @Param('professionalId') professionalId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.queryBus.execute<GetProfessionalServicesQuery, unknown>(
      new GetProfessionalServicesQuery(
        professionalId,
        includeInactive === 'true',
      ),
    );
  }

  @Post(':professionalId/services')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async addService(
    @Param('professionalId') professionalId: string,
    @Body() body: AddServiceDto,
  ) {
    return this.commandBus.execute<AddServiceCommand, unknown>(
      new AddServiceCommand(
        professionalId,
        body.name,
        body.description,
        body.durationMin,
        body.basePrice,
        body.category,
        body.imageUrl,
      ),
    );
  }

  /**
   * Upsert-replace all services in one call.
   * Items with id → update. Items without id → create.
   * Items in DB absent from the list → soft-delete.
   * Pass imageUrl: null on an item to remove its image.
   */
  @Put(':professionalId/services/bulk')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async upsertServicesBulk(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpsertServicesBulkDto,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<UpsertServicesBulkCommand, unknown>(
      new UpsertServicesBulkCommand(professionalId, body.services),
    );
  }

  @Put('services/:serviceId')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async updateService(
    @Param('serviceId') serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.commandBus.execute<UpdateServiceCommand, unknown>(
      new UpdateServiceCommand(
        serviceId,
        body.name,
        body.description,
        body.durationMin,
        body.basePrice,
        body.category,
        body.imageUrl,
      ),
    );
  }

  @Post(':professionalId/services/:serviceId/image/upload')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES } }),
  )
  async uploadServiceImageFile(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    this.assertValidImageFile(file);

    const uploaded = await this.mediaStorageService.uploadServiceImage({
      professionalId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    await this.commandBus.execute<UpdateServiceCommand, unknown>(
      new UpdateServiceCommand(
        serviceId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        uploaded.url,
      ),
    );

    return {
      imageUrl: uploaded.url,
      fileId: uploaded.fileId,
      path: uploaded.filePath,
    };
  }

  @Delete(':professionalId/services/:serviceId/image')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async removeServiceImage(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<RemoveServiceImageCommand, unknown>(
      new RemoveServiceImageCommand(serviceId, professionalId, ''),
    );
  }

  @Put(':professionalId/services/:serviceId/deactivate')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async deactivateService(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.commandBus.execute<DeactivateServiceCommand, unknown>(
      new DeactivateServiceCommand(serviceId, professionalId),
    );
  }

  @Put(':professionalId/services/:serviceId/activate')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async activateService(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.commandBus.execute<ActivateServiceCommand, unknown>(
      new ActivateServiceCommand(serviceId, professionalId),
    );
  }

  @Delete(':professionalId/services/:serviceId')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async deleteService(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.commandBus.execute<DeleteServiceCommand, unknown>(
      new DeleteServiceCommand(serviceId, professionalId),
    );
  }

  @Put(':professionalId/services/:serviceId/communes')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async setCommuneFee(
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
    @Body() body: SetCommuneFeeDto,
  ) {
    return this.commandBus.execute<SetServiceCommuneFeeCommand, unknown>(
      new SetServiceCommuneFeeCommand(
        serviceId,
        professionalId,
        body.commune,
        body.travelFee,
      ),
    );
  }

  /**
   * Get professional availability
   */
  @Get(':professionalId/availability')
  @Public()
  async getProfessionalAvailability(
    @Param('professionalId') professionalId: string,
    @Query('dayOfWeek') dayOfWeek?: number,
  ) {
    return this.queryBus.execute<GetProfessionalAvailabilityQuery, unknown>(
      new GetProfessionalAvailabilityQuery(professionalId, dayOfWeek),
    );
  }

  @Post(':professionalId/availability')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async setAvailability(
    @Param('professionalId') professionalId: string,
    @Body() body: SetAvailabilityDto,
  ) {
    return this.commandBus.execute<SetAvailabilityCommand, unknown>(
      new SetAvailabilityCommand(
        professionalId,
        body.dayOfWeek,
        body.startTime,
        body.endTime,
        body.breakStartTime,
        body.breakEndTime,
      ),
    );
  }

  @Post(':professionalId/availability/bulk')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async setAvailabilityBulk(
    @Param('professionalId') professionalId: string,
    @Body() body: SetAvailabilityBulkDto,
  ) {
    return this.commandBus.execute<SetAvailabilityBulkCommand, unknown>(
      new SetAvailabilityBulkCommand(professionalId, body.availabilities),
    );
  }

  @Put(':professionalId/availability/:dayOfWeek')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async updateAvailability(
    @Param('professionalId') professionalId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body() body: UpdateAvailabilityDto,
  ) {
    return this.commandBus.execute<UpdateAvailabilityCommand, unknown>(
      new UpdateAvailabilityCommand(
        professionalId,
        dayOfWeek,
        body.startTime,
        body.endTime,
        body.breakStartTime,
        body.breakEndTime,
      ),
    );
  }

  @Put(':professionalId/availability/:dayOfWeek/status')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async setAvailabilityStatus(
    @Param('professionalId') professionalId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body() body: SetAvailabilityStatusDto,
  ) {
    return this.commandBus.execute<SetAvailabilityStatusCommand, unknown>(
      new SetAvailabilityStatusCommand(professionalId, dayOfWeek, body.status),
    );
  }

  @Put(':professionalId/availability')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async setAvailabilityForWeek(
    @Param('professionalId') professionalId: string,
    @Body() body: SetAvailabilityForWeekDto,
  ) {
    return this.commandBus.execute<SetAvailabilityForAllWeekCommand, unknown>(
      new SetAvailabilityForAllWeekCommand(
        professionalId,
        body.startTime,
        body.endTime,
        body.breakStartTime,
        body.breakEndTime,
        body.excludeDays,
      ),
    );
  }

  @Delete(':professionalId/availability/:dayOfWeek')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async removeAvailability(
    @Param('professionalId') professionalId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
  ) {
    return this.commandBus.execute<RemoveAvailabilityCommand, unknown>(
      new RemoveAvailabilityCommand(professionalId, dayOfWeek),
    );
  }

  /**
   * Get professional gallery
   */
  @Get(':professionalId/gallery')
  @Public()
  async getProfessionalGallery(
    @Param('professionalId') professionalId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<GetProfessionalGalleryQuery, unknown>(
      new GetProfessionalGalleryQuery(professionalId, page, limit),
    );
  }

  @Post(':professionalId/gallery')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async uploadGalleryItem(
    @Param('professionalId') professionalId: string,
    @Body() body: UploadGalleryItemDto,
  ) {
    return this.commandBus.execute<UploadGalleryItemCommand, unknown>(
      new UploadGalleryItemCommand(
        professionalId,
        body.imageUrl,
        body.caption,
        body.category,
      ),
    );
  }

  @Post(':professionalId/gallery/upload')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_IMAGE_UPLOAD_BYTES,
      },
    }),
  )
  async uploadGalleryImageFile(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    this.assertValidImageFile(file);

    const { pagination } = await this.mediaStorageService.listProfessionalFiles(
      { professionalId, type: 'gallery', page: 1, limit: 1 },
    );
    if (pagination.total >= MAX_GALLERY_IMAGES) {
      throw new BadRequestException(
        `Limite atteinte : maximum ${MAX_GALLERY_IMAGES} images dans la galerie.`,
      );
    }

    const uploaded = await this.mediaStorageService.uploadGalleryImage({
      professionalId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const galleryItem = await this.commandBus.execute<
      UploadGalleryItemCommand,
      unknown
    >(new UploadGalleryItemCommand(professionalId, uploaded.url));

    return {
      imageUrl: uploaded.url,
      fileId: uploaded.fileId,
      path: uploaded.filePath,
      galleryItem,
      maxSizeBytes: MAX_IMAGE_UPLOAD_BYTES,
      acceptedFormats: Array.from(ALLOWED_IMAGE_MIME_TYPES),
    };
  }

  @Post(':professionalId/gallery/upload-bulk')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  @UseInterceptors(
    FilesInterceptor('files', MAX_GALLERY_IMAGES, {
      limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
    }),
  )
  async uploadGalleryImageFiles(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: UploadedImageFile[],
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);

    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Aucun fichier recu. Envoyez les fichiers dans le champ multipart "files".',
      );
    }

    for (const file of files) {
      this.assertValidImageFile(file);
    }

    const { pagination } = await this.mediaStorageService.listProfessionalFiles(
      { professionalId, type: 'gallery', page: 1, limit: 1 },
    );
    const remaining = MAX_GALLERY_IMAGES - pagination.total;
    if (remaining <= 0) {
      throw new BadRequestException(
        `Limite atteinte : maximum ${MAX_GALLERY_IMAGES} images dans la galerie.`,
      );
    }
    if (files.length > remaining) {
      throw new BadRequestException(
        `Trop d'images : vous pouvez encore ajouter ${remaining} image(s) (max ${MAX_GALLERY_IMAGES} au total).`,
      );
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const uploaded = await this.mediaStorageService.uploadGalleryImage({
          professionalId,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        const galleryItem = await this.commandBus.execute<
          UploadGalleryItemCommand,
          unknown
        >(new UploadGalleryItemCommand(professionalId, uploaded.url));
        return { imageUrl: uploaded.url, fileId: uploaded.fileId, galleryItem };
      }),
    );

    return {
      uploaded: results,
      count: results.length,
      maxSizeBytes: MAX_IMAGE_UPLOAD_BYTES,
      acceptedFormats: Array.from(ALLOWED_IMAGE_MIME_TYPES),
    };
  }

  @Delete(':professionalId/avatar')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async removeAvatar(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<RemoveAvatarCommand, unknown>(
      new RemoveAvatarCommand(professionalId),
    );
  }

  @Post(':professionalId/avatar/upload')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_IMAGE_UPLOAD_BYTES,
      },
    }),
  )
  async uploadAvatarImageFile(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    this.assertValidImageFile(file);

    const uploaded = await this.mediaStorageService.uploadAvatarImage({
      professionalId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    await this.commandBus.execute<UpdateProfessionalProfileCommand, unknown>(
      new UpdateProfessionalProfileCommand(
        professionalId,
        undefined,
        undefined,
        uploaded.url,
      ),
    );

    return {
      avatarUrl: uploaded.url,
      fileId: uploaded.fileId,
      path: uploaded.filePath,
      maxSizeBytes: MAX_IMAGE_UPLOAD_BYTES,
      acceptedFormats: Array.from(ALLOWED_IMAGE_MIME_TYPES),
    };
  }

  /**
   * Replace-all gallery: keeps only items in keepIds, soft-deletes the rest.
   * Call this before uploading new items to set the desired state.
   */
  @Put(':professionalId/gallery/replace')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async replaceGallery(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: ReplaceGalleryDto,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<ReplaceGalleryCommand, unknown>(
      new ReplaceGalleryCommand(professionalId, body.keepIds),
    );
  }

  @Put(':professionalId/gallery/reorder')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async reorderGallery(
    @Param('professionalId') professionalId: string,
    @Body() body: ReorderGalleryDto,
  ) {
    return this.commandBus.execute<ReorderGalleryCommand, unknown>(
      new ReorderGalleryCommand(professionalId, body.itemOrders),
    );
  }

  @Put(':professionalId/gallery/:itemId')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async updateGalleryItem(
    @Param('professionalId') professionalId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateGalleryItemDto,
  ) {
    return this.commandBus.execute<UpdateGalleryItemCommand, unknown>(
      new UpdateGalleryItemCommand(
        itemId,
        professionalId,
        body.caption,
        body.category,
      ),
    );
  }

  @Put(':professionalId/gallery/:itemId/publish')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async publishGalleryItem(
    @Param('professionalId') professionalId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.commandBus.execute<PublishGalleryItemCommand, unknown>(
      new PublishGalleryItemCommand(itemId, professionalId),
    );
  }

  @Put(':professionalId/gallery/:itemId/unpublish')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async unpublishGalleryItem(
    @Param('professionalId') professionalId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.commandBus.execute<UnpublishGalleryItemCommand, unknown>(
      new UnpublishGalleryItemCommand(itemId, professionalId),
    );
  }

  @Delete(':professionalId/gallery/:itemId')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async deleteGalleryItem(
    @Param('professionalId') professionalId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.commandBus.execute<DeleteGalleryItemCommand, unknown>(
      new DeleteGalleryItemCommand(itemId, professionalId),
    );
  }

  /**
   * Get bookings for professional management
   */
  @Get(':professionalId/bookings')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async getProfessionalBookings(
    @Param('professionalId') professionalId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<GetProfessionalBookingsQuery, unknown>(
      new GetProfessionalBookingsQuery(professionalId, status, page, limit),
    );
  }

  @Get(':professionalId/bookings/cancellation-requests')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async listCancellationRequests(
    @Param('professionalId') professionalId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<ListBookingCancellationRequestsQuery, unknown>(
      new ListBookingCancellationRequestsQuery(professionalId, page, limit),
    );
  }

  @Put(':professionalId/bookings/:bookingId/confirm')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async confirmBooking(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.commandBus.execute<ConfirmBookingCommand, unknown>(
      new ConfirmBookingCommand(bookingId, professionalId),
    );
  }

  @Put(':professionalId/bookings/:bookingId/reject')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async rejectBooking(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: RejectBookingDto,
  ) {
    return this.commandBus.execute<RejectBookingCommand, unknown>(
      new RejectBookingCommand(bookingId, professionalId, body.reason),
    );
  }

  @Put(':professionalId/bookings/:bookingId/complete')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async completeBooking(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.commandBus.execute<CompleteBookingCommand, unknown>(
      new CompleteBookingCommand(bookingId, professionalId),
    );
  }

  @Put(':professionalId/bookings/:bookingId/no-show')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async markNoShow(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.commandBus.execute<MarkNoShowCommand, unknown>(
      new MarkNoShowCommand(bookingId, professionalId),
    );
  }

  @Put(':professionalId/bookings/:bookingId/cancel')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async cancelBooking(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: SuspendProfessionalDto,
  ) {
    return this.commandBus.execute<CancelBookingCommand, unknown>(
      new CancelBookingCommand(bookingId, professionalId, body.reason),
    );
  }

  @Put(':professionalId/bookings/:bookingId/cancellation-request/approve')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async approveCancellationRequest(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.commandBus.execute<
      ApproveBookingCancellationRequestCommand,
      unknown
    >(new ApproveBookingCancellationRequestCommand(bookingId, professionalId));
  }

  @Put(':professionalId/bookings/:bookingId/cancellation-request/reject')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async rejectCancellationRequest(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: ReviewCancellationRequestDto,
  ) {
    return this.commandBus.execute<
      RejectBookingCancellationRequestCommand,
      unknown
    >(
      new RejectBookingCancellationRequestCommand(
        bookingId,
        professionalId,
        body.reason,
      ),
    );
  }

  /**
   * Get available booking slots for a given date and service list
   * GET /professionals/:id/slots?date=YYYY-MM-DD&serviceIds=id1,id2
   */
  @Get(':professionalId/slots')
  @Public()
  async getAvailableSlots(
    @Param('professionalId') professionalId: string,
    @Query('date') date: string,
    @Query('serviceIds') serviceIdsParam: string,
  ) {
    if (!date || !serviceIdsParam) {
      throw new BadRequestException(
        'Les paramètres date et serviceIds sont requis',
      );
    }
    const serviceIds = serviceIdsParam.split(',').filter(Boolean);
    return this.queryBus.execute<GetAvailableSlotsQuery, unknown>(
      new GetAvailableSlotsQuery(professionalId, date, serviceIds),
    );
  }

  /**
   * Get bookings in calendar view (grouped by day)
   * GET /professionals/:id/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get(':professionalId/bookings/calendar')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async getBookingsCalendar(
    @Param('professionalId') professionalId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('Les paramètres from et to sont requis');
    }
    return this.queryBus.execute<GetProfessionalBookingsCalendarQuery, unknown>(
      new GetProfessionalBookingsCalendarQuery(professionalId, from, to),
    );
  }

  /**
   * Update professional operational settings (travel buffer, etc.)
   * PUT /professionals/:id/settings
   */
  @Put(':professionalId/settings')
  @UseGuards(RolesGuard)
  @Roles('PROFESSIONAL')
  async updateSettings(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfessionalSettingsDto,
  ) {
    await this.assertProfessionalOwnership(professionalId, req.user.id);
    return this.commandBus.execute<UpdateProfessionalSettingsCommand, unknown>(
      new UpdateProfessionalSettingsCommand(
        professionalId,
        body.travelBufferMin,
      ),
    );
  }

  private assertValidImageFile(
    file?: UploadedImageFile,
  ): asserts file is UploadedImageFile {
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier image recu. Envoyez le fichier dans le champ multipart "file".',
      );
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Image trop lourde. Taille maximale: ${MAX_IMAGE_UPLOAD_BYTES} octets (10MB).`,
      );
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Format non supporte (${file.mimetype}). Formats autorises: jpg, jpeg, png, webp.`,
      );
    }
  }

  private async assertProfessionalOwnership(
    professionalId: string,
    requesterUserId: string,
  ): Promise<void> {
    const professional =
      await this.professionalRepository.findById(professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    if (professional.userId !== requesterUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier ce profil professionnel',
      );
    }
  }
}
