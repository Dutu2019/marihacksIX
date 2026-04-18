import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { start, end, profile = "pedestrian" } = await request.json();

  const valhallaQuery = {
    locations: [
      { lat: start.lat, lon: start.lon },
      { lat: end.lat, lon: end.lon },
    ],
    costing: profile,
    costing_options: {
      pedestrian: {
        use_stairs: 0, // The "thirdplace" magic: No stairs
        max_slope: 5, // Maximum 5% grade for easy walking
        walking_speed: 4.0, // Adjusted for accessibility
      },
    },
    units: "kilometers",
  };

  try {
    const response = await fetch("http://localhost:8002/route", {
      method: "POST",
      body: JSON.stringify(valhallaQuery),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Valhalla is unreachable" },
      { status: 500 },
    );
  }
}
