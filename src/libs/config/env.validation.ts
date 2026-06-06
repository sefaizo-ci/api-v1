import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum AppEnvironment {
  Development = 'development',
  Production = 'production',
  Staging = 'staging',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(AppEnvironment)
  NODE_ENV?: AppEnvironment;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  // Optional — services handle missing values with dry-run/fallback modes
  @IsOptional()
  @IsString()
  API_KEY?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  APP_NAME?: string;

  @IsOptional()
  @IsString()
  NOTIFICATIONS_DRY_RUN?: string;

  @IsOptional()
  @IsString()
  OTP_DEV_MODE?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;

  @IsOptional()
  @IsString()
  META_WHATSAPP_API_VERSION?: string;

  @IsOptional()
  @IsString()
  META_WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsOptional()
  @IsString()
  META_WHATSAPP_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  MTARGET_SMS_BASE_URL?: string;

  @IsOptional()
  @IsString()
  MTARGET_SMS_API_KEY?: string;

  @IsOptional()
  @IsString()
  MTARGET_SMS_SENDER?: string;

  @IsOptional()
  @IsString()
  APPWRITE_DRY_RUN?: string;

  @IsOptional()
  @IsString()
  APPWRITE_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  APPWRITE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  APPWRITE_API_KEY?: string;

  @IsOptional()
  @IsString()
  APPWRITE_STORAGE_BUCKET_ID?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Configuration validation failed:\n${messages}`);
  }

  return validated;
}
