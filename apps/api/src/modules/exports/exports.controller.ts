import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateCsvExportDto } from "./dto/create-csv-export.dto";
import { ListExportsDto } from "./dto/list-exports.dto";
import {
  CsvExportDownload,
  CsvExportListResponse,
  CsvExportResponse,
  ExportsService
} from "./exports.service";

type HeaderResponse = {
  setHeader: (name: string, value: string) => void;
};

@Controller("exports")
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExportsDto
  ): Promise<CsvExportListResponse> {
    return this.exportsService.listExports(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCsvExportDto
  ): Promise<CsvExportResponse> {
    return this.exportsService.createExport(user.userId, dto);
  }

  @Get(":exportId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exportId") exportId: string
  ): Promise<CsvExportResponse> {
    return this.exportsService.getExport(user.userId, exportId);
  }

  @Get(":exportId/download")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exportId") exportId: string,
    @Query("token") token: string | undefined,
    @Res({ passthrough: true }) response: HeaderResponse
  ): Promise<string> {
    const download = await this.exportsService.downloadExport(user.userId, exportId, token);

    this.setDownloadHeaders(response, download);

    return download.contents;
  }

  private setDownloadHeaders(response: HeaderResponse, download: CsvExportDownload): void {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${download.filename}"`);
  }
}
