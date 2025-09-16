import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const filename = params.filename;

    // Get receipt data from Firestore
    const receiptDoc = await adminDb.collection('receipts').doc(filename).get();
    
    if (!receiptDoc.exists) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const receiptData = receiptDoc.data();
    
    // Verify the user owns this receipt
    if (receiptData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return the receipt data
    if (receiptData?.dataUrl) {
      // For base64 data URLs, we need to extract the data and return it as a proper response
      const base64Data = receiptData.dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': receiptData.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${receiptData.originalName}"`,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        },
      });
    }

    return NextResponse.json({ error: 'Receipt data not found' }, { status: 404 });

  } catch (error) {
    console.error('Error retrieving receipt:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve receipt' },
      { status: 500 }
    );
  }
}
