import { Injectable } from '@nestjs/common';
import { CreateCapacityDto } from './dto/create-capacity.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';

@Injectable()
export class CapacityService {
  create(createCapacityDto: CreateCapacityDto) {
    return 'This action adds a new capacity';
  }

  findAll() {
    return `This action returns all capacity`;
  }

  findOne(id: number) {
    return `This action returns a #${id} capacity`;
  }

  update(id: number, updateCapacityDto: UpdateCapacityDto) {
    return `This action updates a #${id} capacity`;
  }

  remove(id: number) {
    return `This action removes a #${id} capacity`;
  }
}
