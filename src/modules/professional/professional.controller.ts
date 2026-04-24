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
import { PROFESSIONAL } from '../../common/constants/routes';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  CompleteBookingCommand,
  ConfirmBookingCommand,
  CreateProfessionalProfileCommand,
  DeactivateServiceCommand,
  DeleteGalleryItemCommand,
  DeleteServiceCommand,
  PublishGalleryItemCommand,
  ReactivateProfessionalCommand,
  RejectBookingCommand,
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
  UpdateServiceCommand,
  UploadGalleryItemCommand,
  VerifyProfessionalCommand,
} from './interface/commands';
import {
  AddServiceDto,
  CreateProfessionalProfileDto,
  RejectBookingDto,
  SetAvailabilityDto,
  SetAvailabilityForWeekDto,
  SetAvailabilityStatusDto,
  SetCommuneFeeDto,
  SuspendProfessionalDto,
  UpdateAvailabilityDto,
  UpdateGalleryItemDto,
  UpdateProfessionalProfileDto,
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
  SearchProfessionalsQuery,
} from './interface/queries';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller(PROFESSIONAL.BASE)
export class ProfessionalController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create professional profile
   * Constraint: one user can only create one profile
   */
  @Post(PROFESSIONAL.PROFILE.CREATE)
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

  @Get(PROFESSIONAL.PROFILE.ME)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROFESSIONAL')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.queryBus.execute<GetMyProfessionalProfileQuery, unknown>(
      new GetMyProfessionalProfileQuery(req.user.id),
    );
  }

  @Get(PROFESSIONAL.PROFILE.COMPLETION())
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROFESSIONAL', 'ADMIN')
  async getProfileCompletion(@Param('professionalId') professionalId: string) {
    return this.queryBus.execute<GetProfileCompletionQuery, unknown>(
      new GetProfileCompletionQuery(professionalId),
    );
  }

  @Put(PROFESSIONAL.PROFILE.BY_ID())
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

  @Put(PROFESSIONAL.PROFILE.VERIFY())
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async verifyProfessional(@Param('professionalId') professionalId: string) {
    return this.commandBus.execute<VerifyProfessionalCommand, unknown>(
      new VerifyProfessionalCommand(professionalId),
    );
  }

  @Put(PROFESSIONAL.PROFILE.SUSPEND())
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

  @Put(PROFESSIONAL.PROFILE.REACTIVATE())
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reactivateProfessional(
    @Param('professionalId') professionalId: string,
  ) {
    return this.commandBus.execute<ReactivateProfessionalCommand, unknown>(
      new ReactivateProfessionalCommand(professionalId),
    );
  }

  // ─────────────────────────────────────────
  // LIST / SEARCH / PUBLIC PROFILE
  // ─────────────────────────────────────────

  @Get(PROFESSIONAL.LIST)
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
        isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
      location,
    };

    return this.queryBus.execute<ListProfessionalsQuery, unknown>(
      new ListProfessionalsQuery(filters, page, limit),
    );
  }

  @Get(PROFESSIONAL.SEARCH)
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

  @Get(PROFESSIONAL.BY_ID())
  async getProfessionalProfile(
    @Param('professionalId') professionalId: string,
  ) {
    return this.queryBus.execute<GetProfessionalProfileQuery, unknown>(
      new GetProfessionalProfileQuery(professionalId),
    );
  }

  // ─────────────────────────────────────────
  // SERVICES
  // ─────────────────────────────────────────

  @Get(PROFESSIONAL.SERVICES.LIST())
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

  @Post(PROFESSIONAL.SERVICES.ADD())
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

  @Put(PROFESSIONAL.SERVICES.UPDATE())
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

  @Put(PROFESSIONAL.SERVICES.ACTIVATE())
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

  @Put(PROFESSIONAL.SERVICES.DEACTIVATE())
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

  @Delete(PROFESSIONAL.SERVICES.DELETE())
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

  @Put(PROFESSIONAL.SERVICES.SET_COMMUNE_FEE())
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

  // ─────────────────────────────────────────
  // AVAILABILITY
  // ─────────────────────────────────────────

  @Get(PROFESSIONAL.AVAILABILITY.GET())
  async getProfessionalAvailability(
    @Param('professionalId') professionalId: string,
    @Query('dayOfWeek') dayOfWeek?: number,
  ) {
    return this.queryBus.execute<GetProfessionalAvailabilityQuery, unknown>(
      new GetProfessionalAvailabilityQuery(professionalId, dayOfWeek),
    );
  }

  @Post(PROFESSIONAL.AVAILABILITY.SET())
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

  @Put(PROFESSIONAL.AVAILABILITY.SET_WEEK())
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

  @Put(PROFESSIONAL.AVAILABILITY.UPDATE())
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

  @Put(PROFESSIONAL.AVAILABILITY.SET_STATUS())
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

  @Delete(PROFESSIONAL.AVAILABILITY.REMOVE())
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

  // ─────────────────────────────────────────
  // GALLERY
  // ─────────────────────────────────────────

  @Get(PROFESSIONAL.GALLERY.LIST())
  async getProfessionalGallery(
    @Param('professionalId') professionalId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<GetProfessionalGalleryQuery, unknown>(
      new GetProfessionalGalleryQuery(professionalId, page, limit),
    );
  }

  @Post(PROFESSIONAL.GALLERY.UPLOAD())
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

  @Put(PROFESSIONAL.GALLERY.REORDER())
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

  @Put(PROFESSIONAL.GALLERY.PUBLISH())
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

  @Put(PROFESSIONAL.GALLERY.UNPUBLISH())
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

  @Put(PROFESSIONAL.GALLERY.UPDATE())
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

  @Delete(PROFESSIONAL.GALLERY.DELETE())
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

  // ─────────────────────────────────────────
  // BOOKINGS
  // ─────────────────────────────────────────

  @Get(PROFESSIONAL.BOOKINGS.LIST())
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

  @Put(PROFESSIONAL.BOOKINGS.CONFIRM())
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

  @Put(PROFESSIONAL.BOOKINGS.REJECT())
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

  @Put(PROFESSIONAL.BOOKINGS.COMPLETE())
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
}
