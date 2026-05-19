import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { TagListResponse, TagResponse, TagsService } from "./tags.service";

@Controller("tags")
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<TagListResponse> {
    return this.tagsService.listTags(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTagDto): Promise<TagResponse> {
    return this.tagsService.createTag(user.userId, dto);
  }

  @Patch(":tagId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tagId") tagId: string,
    @Body() dto: UpdateTagDto
  ): Promise<TagResponse> {
    return this.tagsService.updateTag(user.userId, tagId, dto);
  }

  @Delete(":tagId")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tagId") tagId: string
  ): Promise<{ success: true }> {
    return this.tagsService.deleteTag(user.userId, tagId);
  }
}
