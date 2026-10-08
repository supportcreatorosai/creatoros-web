import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const customFilename = searchParams.get('filename');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    // Fetch the remote file
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch remote file: ${response.statusText}`);
    }

    // Get the file as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const filename = customFilename || "creatoros_download";

    // Create the response with attachment headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    return new NextResponse('Failed to download file', { status: 500 });
  }
}
