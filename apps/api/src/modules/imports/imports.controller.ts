import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ListImportsDto } from "./dto/list-imports.dto";
import { PreviewCsvImportDto } from "./dto/preview-csv-import.dto";
import {
  CsvImportConfirmResponse,
  CsvImportHistoryListResponse,
  CsvImportPreviewResponse,
  CsvImportUploadFile,
  CsvImportUploadResponse,
  ImportsService,
  maxCsvFileBytes
} from "./imports.service";

@Controller("imports")
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListImportsDto
  ): Promise<CsvImportHistoryListResponse> {
    return this.importsService.listImports(user.userId, query);
  }

  @Post("csv")
  @UseInterceptors(FileInterceptor("file", {
    limits: {
      fileSize: maxCsvFileBytes + 1,
      files: 1
    }
  }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: CsvImportUploadFile | undefined
  ): Promise<CsvImportUploadResponse> {
    return this.importsService.uploadCsv(user.userId, file);
  }

  @Post(":importId/preview")
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("importId") importId: string,
    @Body() dto: PreviewCsvImportDto
  ): Promise<CsvImportPreviewResponse> {
    return this.importsService.previewImport(user.userId, importId, dto);
  }

  @Post(":importId/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("importId") importId: string
  ): Promise<CsvImportConfirmResponse> {
    return this.importsService.confirmImport(user.userId, importId);
  }
}
