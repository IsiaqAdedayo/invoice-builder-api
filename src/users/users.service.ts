import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryUsersDto } from './dto/query-users.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(query: QueryUsersDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 50);

    const qb = this.userRepo.createQueryBuilder('user');

    // FILTER BY ROLE
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    // SEARCH (EMAIL)
    if (query.search) {
      qb.andWhere('user.email ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // PAGINATION
    qb.skip((page - 1) * limit).take(limit);

    qb.select(['user.id', 'user.email', 'user.role', 'user.createdAt']);

    qb.orderBy('user.createdAt', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}
