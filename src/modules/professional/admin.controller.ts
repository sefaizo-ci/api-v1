import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { Roles } from '../../libs/decorators/roles.decorator';
import { JwtAuthGuard } from '../sentinel/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../sentinel/infrastructure/guards/roles.guard';
import {
  ApproveServiceCategoryRequestCommand,
  CreateServiceCategoryCommand,
  DeleteServiceCategoryCommand,
  ReactivateProfessionalCommand,
  RejectServiceCategoryRequestCommand,
  SuspendProfessionalCommand,
  UpdateServiceCategoryCommand,
  VerifyProfessionalCommand,
} from './interface/commands';
import {
  ApproveServiceCategoryRequestDto,
  CreateServiceCategoryDto,
  RejectServiceCategoryRequestDto,
  SuspendProfessionalDto,
  UpdateServiceCategoryDto,
} from './interface/dtos';
import { ListServiceCategoryRequestsQuery } from './interface/queries';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller('professional')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProfessionalAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Put('profile/:professionalId/verify')
  async verifyProfessional(@Param('professionalId') professionalId: string) {
    return this.commandBus.execute<VerifyProfessionalCommand, unknown>(
      new VerifyProfessionalCommand(professionalId),
    );
  }

  @Put('profile/:professionalId/suspend')
  async suspendProfessional(
    @Param('professionalId') professionalId: string,
    @Body() body: SuspendProfessionalDto,
  ) {
    return this.commandBus.execute<SuspendProfessionalCommand, unknown>(
      new SuspendProfessionalCommand(professionalId, body.reason),
    );
  }

  @Put('profile/:professionalId/reactivate')
  async reactivateProfessional(
    @Param('professionalId') professionalId: string,
  ) {
    return this.commandBus.execute<ReactivateProfessionalCommand, unknown>(
      new ReactivateProfessionalCommand(professionalId),
    );
  }

  @Post('services/categories')
  @Post('admin/services/categories')
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
  async deleteServiceCategory(
    @Param('categoryId') categoryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commandBus.execute<DeleteServiceCategoryCommand, unknown>(
      new DeleteServiceCategoryCommand(categoryId, req.user.id),
    );
  }

  @Get('services/category-requests/admin')
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
}
