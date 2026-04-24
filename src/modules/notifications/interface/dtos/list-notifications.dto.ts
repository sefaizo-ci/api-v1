import { IsIn, IsOptional } from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @IsIn(['ALL', 'READ', 'UNREAD'])
  status?: 'ALL' | 'READ' | 'UNREAD';
}
