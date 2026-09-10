import { afterEach, describe, expect, it, vi } from "vitest";
import { changeAdminUserPassword } from "./client";

describe("API error metadata", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves status and body for a FastAPI 422 password reset response", async () => {
    const responseBody = JSON.stringify({
      detail: [{
        type: "string_too_short",
        loc: ["body", "new_password"],
        msg: "String should have at least 4 characters",
        input: "abc",
        ctx: { min_length: 4 }
      }]
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(responseBody, {
        status: 422,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(changeAdminUserPassword("user-id", "abc")).rejects.toMatchObject({
      status: 422,
      message: responseBody
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/users/user-id/password"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ new_password: "abc" })
      })
    );
  });
});
