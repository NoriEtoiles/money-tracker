import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  listAuditEvents,
  requestAccountDeletion,
  updateProfile
} from "./settings";

describe("settings API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates profile with bearer auth and existing profile fields", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        "Authorization": "Bearer token",
        "Content-Type": "application/json"
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        defaultCurrency: "IDR",
        displayName: "Noir",
        locale: "id-ID",
        timezone: "Asia/Jakarta"
      });

      return jsonResponse({
        defaultCurrency: "IDR",
        displayName: "Noir",
        email: "user@example.com",
        id: "user-1",
        locale: "id-ID",
        timezone: "Asia/Jakarta"
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await updateProfile("token", {
      defaultCurrency: "IDR",
      displayName: "Noir",
      locale: "id-ID",
      timezone: "Asia/Jakarta"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/v1/me", expect.objectContaining({
      method: "PATCH"
    }));
  });

  it("sends password change and delete request bodies without client-side persistence", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        "Authorization": "Bearer token",
        "Content-Type": "application/json"
      });

      if (url.endsWith("/auth/change-password")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          currentPassword: "current",
          newPassword: "new-password"
        });

        return jsonResponse({
          revokedCount: 2,
          success: true
        });
      }

      expect(JSON.parse(String(init?.body))).toEqual({
        confirmationPhrase: "DELETE MY ACCOUNT",
        currentPassword: "current"
      });

      return jsonResponse({
        request: {
          requestedAt: "2026-06-04T00:00:00.000Z",
          status: "pending"
        }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await changePassword("token", {
      currentPassword: "current",
      newPassword: "new-password"
    });
    await requestAccountDeletion("token", {
      confirmationPhrase: "DELETE MY ACCOUNT",
      currentPassword: "current"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lists audit events with cursor pagination", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      items: [],
      nextCursor: null
    }));

    vi.stubGlobal("fetch", fetchMock);

    await listAuditEvents("token", "audit-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/audit-events?cursor=audit-1",
      expect.objectContaining({
        headers: {
          "Authorization": "Bearer token",
          "Content-Type": "application/json"
        }
      })
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
