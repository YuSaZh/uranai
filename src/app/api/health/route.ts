import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      app: "uranai",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
