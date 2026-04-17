import { ProfessionalEntity } from '../entities/professional.entity';

/**
 * ProfessionalRepository Interface
 * Defines the contract for persisting Professional aggregate
 */
export interface IProfessionalRepository {
  /**
   * Save a new professional or update existing
   */
  save(professional: ProfessionalEntity): Promise<void>;

  /**
   * Find professional by ID
   */
  findById(id: string): Promise<ProfessionalEntity | null>;

  /**
   * Find professional by userId (unique constraint)
   */
  findByUserId(userId: string): Promise<ProfessionalEntity | null>;

  /**
   * Find all professionals (with optional filters)
   */
  findAll(filters?: {
    status?: string;
    isVerified?: boolean;
    location?: string;
  }): Promise<ProfessionalEntity[]>;

  /**
   * Delete (soft delete) professional
   */
  delete(id: string): Promise<void>;

  /**
   * Check if professional exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Check if user already has a professional profile
   */
  hasProfile(userId: string): Promise<boolean>;
}
