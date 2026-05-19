import { Injectable } from "@nestjs/common";

export type HealthStatus = {
  service: "money-tracker-api";
  status: "ok";
  timestamp: string;
};

@Injectable()
export class HealthService {
  getHealth(): HealthStatus {
    return {
      service: "money-tracker-api",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }
}
