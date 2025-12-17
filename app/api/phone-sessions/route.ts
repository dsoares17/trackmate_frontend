import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type LapPayload = {
  index: number;
  startTime: number;
  endTime: number;
  durationMs: number;
};

type PhoneSessionPayload = {
  trackId: string;
  carId: string | null;
  source: "phone_gps";
  accuracyTier: "phone";
  device: string | null;
  samplingHz: number | null;
  sessionStartedAt: number;
  sessionEndedAt: number;
  laps: LapPayload[];
};

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------
    // 1. Auth: read and validate Authorization header
    // ------------------------------------------------------------
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice("Bearer ".length).trim();
    if (!accessToken) {
      return NextResponse.json(
        { error: "Empty bearer token" },
        { status: 401 }
      );
    }

    // Get the admin client (uses service role key, bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("AUTH ERROR:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id as string;

    // ------------------------------------------------------------
    // 2. Parse & validate payload
    // ------------------------------------------------------------
    const payload = (await request.json()) as PhoneSessionPayload;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const {
      trackId,
      carId,
      source,
      accuracyTier,
      device,
      samplingHz,
      sessionStartedAt,
      sessionEndedAt,
      laps,
    } = payload;

    if (!trackId || typeof trackId !== "string") {
      return NextResponse.json({ error: "Invalid trackId" }, { status: 400 });
    }

    if (carId !== null && typeof carId !== "string") {
      return NextResponse.json({ error: "Invalid carId" }, { status: 400 });
    }

    if (source !== "phone_gps") {
      return NextResponse.json(
        { error: "Invalid source, expected phone_gps" },
        { status: 400 }
      );
    }

    if (accuracyTier !== "phone") {
      return NextResponse.json(
        { error: "Invalid accuracyTier, expected phone" },
        { status: 400 }
      );
    }

    if (!Array.isArray(laps) || laps.length === 0) {
      return NextResponse.json(
        { error: "At least one lap is required" },
        { status: 400 }
      );
    }

    if (
      typeof sessionStartedAt !== "number" ||
      typeof sessionEndedAt !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid session timestamps" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // 3. Validate track exists
    // ------------------------------------------------------------
    const { data: trackData, error: trackError } = await supabaseAdmin
      .from("tracks")
      .select("id")
      .eq("id", trackId)
      .single();

    if (trackError || !trackData) {
      console.error("TRACK ERROR:", trackError);
      return NextResponse.json(
        { error: "Invalid trackId" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // 4. Validate car (if provided) belongs to user
    // ------------------------------------------------------------
    let finalCarId: string | null = null;

    if (carId) {
      const { data: carData, error: carError } = await supabaseAdmin
        .from("cars")
        .select("id, user_id")
        .eq("id", carId)
        .single();

      if (carError || !carData) {
        console.error("CAR ERROR:", carError);
        return NextResponse.json(
          { error: "Invalid carId" },
          { status: 400 }
        );
      }

      if (carData.user_id !== userId) {
        return NextResponse.json(
          { error: "Car does not belong to user" },
          { status: 403 }
        );
      }

      finalCarId = carData.id;
    }

    // ------------------------------------------------------------
    // 5. Debug log payload (already seen in your logs)
    // ------------------------------------------------------------
    console.log("============================================================");
    console.log("PHONE SESSION PAYLOAD");
    console.log("============================================================");
    console.log("User ID:", userId);
    console.log("Track ID:", trackId);
    console.log("Car ID:", finalCarId);
    console.log("Source:", source);
    console.log("Accuracy Tier:", accuracyTier);
    console.log("Device:", device);
    console.log("Sampling Hz:", samplingHz);
    console.log(
      "Session Started:",
      new Date(sessionStartedAt).toISOString()
    );
    console.log("Session Ended:", new Date(sessionEndedAt).toISOString());
    console.log("Laps:", laps.length);
    laps.forEach((lap, idx) => {
      console.log(
        `  Lap ${idx + 1}: ${lap.durationMs}ms (start=${new Date(
          lap.startTime
        ).toISOString()}, end=${new Date(lap.endTime).toISOString()})`
      );
    });
    console.log("============================================================");

    // ------------------------------------------------------------
    // 6. Insert into phone_sessions (MATCHES YOUR TABLE SCHEMA)
    // columns (from your earlier dump):
    // id, driver_id, track_id, car_id, source, accuracy_tier,
    // device, sampling_hz, started_at, ended_at, created_at, user_id
    // ------------------------------------------------------------
    const { data: phoneSessionData, error: phoneSessionError } =
      await supabaseAdmin
        .from("phone_sessions")
        .insert({
          user_id: userId,
          driver_id: userId,
          track_id: trackId,
          car_id: finalCarId,
          source,
          accuracy_tier: accuracyTier,
          device: device ?? null,
          sampling_hz: samplingHz,
          started_at: new Date(sessionStartedAt).toISOString(),
          ended_at: new Date(sessionEndedAt).toISOString(),
        })
        .select("id")
        .single();

    if (phoneSessionError || !phoneSessionData) {
      console.error(
        "PHONE SESSION INSERT ERROR:",
        phoneSessionError?.message ?? phoneSessionError
      );
      return NextResponse.json(
        { error: "Failed to create phone session" },
        { status: 500 }
      );
    }

    const phoneSessionId = phoneSessionData.id as string;

    // ------------------------------------------------------------
    // 7. Insert laps (ALIGN WITH YOUR LAP SCHEMA)
    // From your earlier description, laps table columns include at least:
    // id, user_id, track_id, car_id, lap_time_ms, date,
    // is_public, session_label, conditions, temperature_band, source, ...
    // We keep it simple and safe.
    // ------------------------------------------------------------
    const lapsToInsert = laps.map((lap) => ({
      user_id: userId,
      track_id: trackId,
      car_id: finalCarId,
      lap_time_ms: Math.round(lap.durationMs),
      date: new Date(lap.endTime).toISOString(),
      is_public: true, // for now make phone laps public
      session_label: null,
      conditions: null,
      temperature_band: null,
      source: "phone_gps",
      // only include session_id / accuracy_tier here IF you have added them
      // session_id: phoneSessionId,
      // accuracy_tier: "phone",
    }));

    const { data: lapsData, error: lapsError } = await supabaseAdmin
      .from("laps")
      .insert(lapsToInsert)
      .select("id");

    if (lapsError || !lapsData) {
      console.error("LAPS INSERT ERROR:", lapsError?.message ?? lapsError);
      return NextResponse.json(
        { error: "Failed to insert laps" },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // 8. Success
    // ------------------------------------------------------------
    return NextResponse.json({
      ok: true,
      phoneSessionId,
      lapsInserted: lapsToInsert.length,
    });
  } catch (err) {
    console.error("UNEXPECTED ERROR in /api/phone-sessions:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}