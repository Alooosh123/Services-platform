import { Module } from '@nestjs/common';
import { UsersAndAgentsController } from './users-and-agents.controller';
import { SubAgentsService } from './sub-agents.service';
import { TiersService } from './tiers.service';

@Module({
  controllers: [UsersAndAgentsController],
  providers: [SubAgentsService, TiersService],
  exports: [SubAgentsService, TiersService],
})
export class UsersAndAgentsModule {}
