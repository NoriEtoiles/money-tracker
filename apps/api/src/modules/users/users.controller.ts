import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CurrentUserResponse, UsersService } from "./users.service";

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserResponse> {
    return this.usersService.getCurrentUser(user.userId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto
  ): Promise<CurrentUserResponse> {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
