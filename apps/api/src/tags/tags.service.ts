import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Tag, TagData } from '@apply-tracker/shared';
import { toTag } from '../applications/application.mapper.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    return tags.map(toTag);
  }

  async create(userId: string, data: TagData): Promise<Tag> {
    return this.uniqueName(async () =>
      toTag(await this.prisma.tag.create({ data: { userId, ...data } })),
    );
  }

  async update(userId: string, id: string, data: TagData): Promise<Tag> {
    return this.uniqueName(async () => {
      const { count } = await this.prisma.tag.updateMany({ where: { id, userId }, data });
      if (count === 0) throw new NotFoundException('Tag not found');
      return toTag(await this.prisma.tag.findUniqueOrThrow({ where: { id } }));
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.tag.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Tag not found');
  }

  private async uniqueName<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A tag with this name already exists');
      }
      throw error;
    }
  }
}
