import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { Roles } from '../../libs/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  ApproveServiceCategoryRequestCommand,
  CompleteBookingCommand,
  ConfirmBookingCommand,
  CreateProfessionalProfileCommand,
  CreateServiceCategoryCommand,
  CreateServiceCategoryRequestCommand,
  DeactivateServiceCommand,
  DeleteGalleryItemCommand,
  DeleteServiceCategoryCommand,
  DeleteServiceCommand,
  PublishGalleryItemCommand,
  ReactivateProfessionalCommand,
  RejectBookingCommand,
  RejectServiceCategoryRequestCommand,
  RemoveAvailabilityCommand,
  ReorderGalleryCommand,
  SetAvailabilityCommand,
  SetAvailabilityForAllWeekCommand,
  SetAvailabilityStatusCommand,
  SetServiceCommuneFeeCommand,
  SuspendProfessionalCommand,
  UnpublishGalleryItemCommand,
  UpdateAvailabilityCommand,
  UpdateGalleryItemCommand,
  UpdateProfessionalProfileCommand,
  UpdateServiceCategoryCommand,
  UpdateServiceCommand,
  UploadGalleryItemCommand,
  VerifyProfessionalCommand,
} from './interface/commands';
import {
  ApproveBookingCancellationRequestCommand,
  RejectBookingCancellationRequestCommand,
} from './interface/commands/booking.commands';
import {
  AddServiceDto,
  ApproveServiceCategoryRequestDto,
  CreateProfessionalProfileDto,
  CreateServiceCategoryDto,
  CreateServiceCategoryRequestDto,
  RejectBookingDto,
  RejectServiceCategoryRequestDto,
  ReviewCancellationRequestDto,
  SetAvailabilityDto,
  SetAvailabilityForWeekDto,
  SetAvailabilityStatusDto,
  SetCommuneFeeDto,
  SuspendProfessionalDto,
  UpdateAvailabilityDto,
  UpdateGalleryItemDto,
  UpdateProfessionalProfileDto,
  UpdateServiceCategoryDto,
  UpdateServiceDto,
  UploadGalleryItemDto,
} from './interface/dtos';
import { ReorderGalleryDto } from './interface/dtos/gallery.dto';
import {
  GetMyProfessionalProfileQuery,
  GetProfessionalAvailabilityQuery,
  GetProfessionalBookingsQuery,
  GetProfessionalGalleryQuery,
  GetProfessionalProfileQuery,
  GetProfessionalServicesQuery,
  GetProfileCompletionQuery,
  ListProfessionalsQuery,
  ListServiceCategoriesQuery,
  ListServiceCategoryRequestsQuery,
  SearchProfessionalsQuery,
} from './interface/queries';
import { ListBookingCancellationRequestsQuery } from './interface/queries/professional.queries';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller('professional')
export class ProfessionalController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create professional profile
   * Constraint: one user can only create one profile
   */
  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
        body.avatarUrl,
        body.location,
        body.address,
        body.latitude,
        body.longitude,
      ),
    );
  }

  /**
   * Update my profile
   */
  @Put('profile/:professionalId')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
        body.avatarUrl,
        body.location,
        body.address,
        body.latitude,
        body.longitude,
      ),
    );
  }

  /**
   * Verify professional (admin only)
   */
  @Put('profile/:professionalId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async verifyProfessional(@Param('professionalId') professionalId: string) {
    return this.commandBus.execute<VerifyProfessionalCommand, unknown>(
      new VerifyProfessionalCommand(professionalId),
    );
  }

  /**
   * Suspend professional (admin only)
   */
  @Put('profile/:professionalId/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async suspendProfessional(
    @Param('professionalId') professionalId: string,
    @Body() body: SuspendProfessionalDto,
  ) {
    return this.commandBus.execute<SuspendProfessionalCommand, unknown>(
      new SuspendProfessionalCommand(professionalId, body.reason),
    );
  }

  /**
   * Reactivate professional (admin only)
   */
  @Put('profile/:professionalId/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reactivateProfessional(
    @Param('professionalId') professionalId: string,
  ) {
    return this.commandBus.execute<ReactivateProfessionalCommand, unknown>(
      new ReactivateProfessionalCommand(professionalId),
    );
  }

  /**
   * Get my professional profile
   */
  @Get('profile/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetMyProfessionalProfileQuery, unknown>(
      new GetMyProfessionalProfileQuery(req.user.id),
    );
  }

  /**
   * Get profile completion
   */
  @Get('profile/:professionalId/completion')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('services/categories')
  async listServiceCategories(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.queryBus.execute<ListServiceCategoriesQuery, unknown>(
      new ListServiceCategoriesQuery(page, limit),
    );
  }

  @Post('services/categories')
  @Post('admin/services/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createServiceCategory(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateServiceCategoryDto,
  ) {
    return this.commandBus.execute<CreateServiceCategoryCommand, unknown>(
      new CreateServiceCategoryCommand(
        body.name,
        body.description,
        req.user.id,
      ),
    );
  }

  @Put('services/categories/:categoryId')
  @Put('admin/services/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateServiceCategory(
    @Param('categoryId') categoryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateServiceCategoryDto,
  ) {
    return this.commandBus.execute<UpdateServiceCategoryCommand, unknown>(
      new UpdateServiceCategoryCommand(
        categoryId,
        body.name,
        body.description,
        req.user.id,
      ),
    );
  }

  @Delete('services/categories/:categoryId')
  @Delete('admin/services/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteServiceCategory(
    @Param('categoryId') categoryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commandBus.execute<DeleteServiceCategoryCommand, unknown>(
      new DeleteServiceCategoryCommand(categoryId, req.user.id),
    );
  }

  @Post(':professionalId/services/category-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('services/category-requests/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listAllServiceCategoryRequests(
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<ListServiceCategoryRequestsQuery, unknown>(
      new ListServiceCategoryRequestsQuery(undefined, status, page, limit),
    );
  }

  @Put('services/category-requests/admin/:requestId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approveServiceCategoryRequest(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: ApproveServiceCategoryRequestDto,
  ) {
    return this.commandBus.execute<
      ApproveServiceCategoryRequestCommand,
      unknown
    >(
      new ApproveServiceCategoryRequestCommand(
        requestId,
        req.user.id,
        body.approvedName,
        body.approvedDescription,
      ),
    );
  }

  @Put('services/category-requests/admin/:requestId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async rejectServiceCategoryRequest(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: RejectServiceCategoryRequestDto,
  ) {
    return this.commandBus.execute<
      RejectServiceCategoryRequestCommand,
      unknown
    >(
      new RejectServiceCategoryRequestCommand(
        requestId,
        req.user.id,
        body.reviewNote,
      ),
    );
  }

  /**
   * Get professional services
   */
  @Get(':professionalId/services')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
      ),
    );
  }

  @Put('services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
      ),
    );
  }

  @Put(':professionalId/services/:serviceId/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  async getProfessionalAvailability(
    @Param('professionalId') professionalId: string,
    @Query('dayOfWeek') dayOfWeek?: number,
  ) {
    return this.queryBus.execute<GetProfessionalAvailabilityQuery, unknown>(
      new GetProfessionalAvailabilityQuery(professionalId, dayOfWeek),
    );
  }

  @Post(':professionalId/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Put(':professionalId/availability/:dayOfWeek')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Put(':professionalId/gallery/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROFESSIONAL')
  async completeBooking(
    @Param('professionalId') professionalId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.commandBus.execute<CompleteBookingCommand, unknown>(
      new CompleteBookingCommand(bookingId, professionalId),
    );
  }

  @Put(':professionalId/bookings/:bookingId/cancellation-request/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
}
