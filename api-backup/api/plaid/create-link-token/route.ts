import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest, Products, CountryCode } from 'plaid';

// Determine Plaid environment - default to sandbox if not set
const plaidEnv = process.env.PLAID_ENV || 'sandbox';
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;

if (!plaidClientId || !plaidSecret) {
  console.error('❌ Plaid credentials not configured:', {
    hasClientId: !!plaidClientId,
    hasSecret: !!plaidSecret,
    env: plaidEnv
  });
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': plaidClientId,
      'PLAID-SECRET': plaidSecret,
    },
  },
});

const client = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [Plaid Link Token] Creating link token...');
    
    const { userId } = await request.json();

    if (!userId) {
      console.error('❌ [Plaid Link Token] No user ID provided');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('✅ [Plaid Link Token] User ID received:', userId);

    const configs: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: 'WriteOff',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    console.log('🔄 [Plaid Link Token] Calling Plaid API...');
    const createTokenResponse = await client.linkTokenCreate(configs);
    
    console.log('✅ [Plaid Link Token] Link token created successfully');
    
    return NextResponse.json({
      link_token: createTokenResponse.data.link_token,
    });
  } catch (error) {
    console.error('❌ [Plaid Link Token] Error creating link token:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('❌ [Plaid Link Token] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create link token. Please check your Plaid configuration.' },
      { status: 500 }
    );
  }
}
