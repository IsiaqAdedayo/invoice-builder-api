import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDomain } from '../users/domain/user.domain';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: { email: string; password: string; role: string }) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await UserDomain.hashPassword(dto.password);

    const user = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      role: dto.role || 'user',
    });

    return this.userRepo.save(user);
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isValid = await UserDomain.comparePassword(
      dto.password,
      user.password,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid credentials');
    }

    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }
}
