import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CategoriesService, CategoryListResponse, CategoryResponse } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CategoryListResponse> {
    return this.categoriesService.listCategoryResponse(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto
  ): Promise<CategoryResponse> {
    return this.categoriesService.createCategory(user.userId, dto);
  }

  @Patch(":categoryId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateCategoryDto
  ): Promise<CategoryResponse> {
    return this.categoriesService.updateCategory(user.userId, categoryId, dto);
  }

  @Delete(":categoryId")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("categoryId") categoryId: string
  ): Promise<{ mode: "archived"; success: true }> {
    return this.categoriesService.archiveCategory(user.userId, categoryId);
  }
}
