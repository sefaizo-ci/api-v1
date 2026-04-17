/**
 * ValueObject for commune-specific fees
 * Represents travel fees and availability for a service in a specific commune
 */
export class CommuneFeeVO {
  constructor(
    public readonly commune: string,
    public readonly travelFee: number,
    public readonly isAvailable: boolean = true,
  ) {}

  static create(
    commune: string,
    travelFee: number,
    isAvailable?: boolean,
  ): CommuneFeeVO {
    if (!commune || commune.trim().length === 0) {
      throw new Error('Commune name is required');
    }
    if (travelFee < 0) {
      throw new Error('Travel fee cannot be negative');
    }
    return new CommuneFeeVO(commune, travelFee, isAvailable ?? true);
  }

  calculateTotalPrice(basePrice: number): number {
    return basePrice + this.travelFee;
  }
}

/**
 * ServiceOffering Entity
 * Represents a service offered by a professional
 */
export class ServiceOfferingEntity {
  id: string;
  professionalId: string;
  name: string;
  description?: string;
  durationMin: number;
  basePrice: number;
  category: string;
  isActive: boolean;
  communeFees: CommuneFeeVO[] = [];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(props: {
    id: string;
    professionalId: string;
    name: string;
    description?: string;
    durationMin: number;
    basePrice: number;
    category: string;
    isActive?: boolean;
    communeFees?: CommuneFeeVO[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }) {
    this.id = props.id;
    this.professionalId = props.professionalId;
    this.name = props.name;
    this.description = props.description;
    this.durationMin = props.durationMin;
    this.basePrice = props.basePrice;
    this.category = props.category;
    this.isActive = props.isActive ?? true;
    this.communeFees = props.communeFees ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: {
    id: string;
    professionalId: string;
    name: string;
    description?: string;
    durationMin: number;
    basePrice: number;
    category: string;
  }): ServiceOfferingEntity {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Service name is required');
    }
    if (props.durationMin <= 0) {
      throw new Error('Duration must be greater than 0');
    }
    if (props.basePrice < 0) {
      throw new Error('Price cannot be negative');
    }

    return new ServiceOfferingEntity({
      ...props,
      id: props.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Add or update commune fee for this service
   */
  setCommeFee(commune: string, travelFee: number): void {
    const existing = this.communeFees.find((cf) => cf.commune === commune);
    if (existing) {
      const index = this.communeFees.indexOf(existing);
      this.communeFees[index] = CommuneFeeVO.create(commune, travelFee);
    } else {
      this.communeFees.push(CommuneFeeVO.create(commune, travelFee));
    }
    this.updatedAt = new Date();
  }

  /**
   * Get total price including commune travel fee
   */
  getPriceForCommune(commune: string): number {
    const fee = this.communeFees.find((cf) => cf.commune === commune);
    if (!fee) {
      return this.basePrice; // Return base price if no specific fee found
    }
    return fee.calculateTotalPrice(this.basePrice);
  }

  /**
   * Deactivate this service
   */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Reactivate this service
   */
  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Check if service is available for booking
   */
  isAvailable(): boolean {
    return this.isActive && !this.deletedAt;
  }
}
