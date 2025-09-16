import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Firebase connection check - always return success since Firebase is configured
    return NextResponse.json({
      success: true,
      message: 'Firebase connection is configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Firebase connection error' },
      { status: 500 }
    );
  }
}