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

export class ServiceOfferingEntity {
  id: string;
  professionalId: string;
  name: string;
  description?: string;
  imageUrl?: string;
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
    imageUrl?: string;
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
    this.imageUrl = props.imageUrl;
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  setImage(url: string): void {
    this.imageUrl = url;
    this.updatedAt = new Date();
  }

  clearImage(): void {
    this.imageUrl = undefined;
    this.updatedAt = new Date();
  }

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

  getPriceForCommune(commune: string): number {
    const fee = this.communeFees.find((cf) => cf.commune === commune);
    if (!fee) {
      return this.basePrice;
    }
    return fee.calculateTotalPrice(this.basePrice);
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  isAvailable(): boolean {
    return this.isActive && !this.deletedAt;
  }
}
