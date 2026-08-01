import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "demos/code-compass-demo-complete-compressed.mp4", // Filter to only video files in the videos folder
      limit: 10, // Limit to 10 videos
    });

    // Filter for video files only (mp4, webm, etc.)
    const videos = blobs.filter((blob) =>
      /\.(mp4|webm|mov|avi)$/i.test(blob.pathname),
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error listing videos from Vercel Blob:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 },
    );
  }
}
