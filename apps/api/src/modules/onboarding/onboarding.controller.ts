import { Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OnboardingDefaultDataResponse, OnboardingService } from "./onboarding.service";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("default-data")
  @UseGuards(JwtAuthGuard)
  seedDefaultData(@CurrentUser() user: AuthenticatedUser): Promise<OnboardingDefaultDataResponse> {
    return this.onboardingService.seedDefaultData(user.userId);
  }
}
