# Vercel Deployment Guide

This guide will help you deploy your WriteOff app to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your GitHub repository connected to Vercel
3. All required environment variables

## Step 1: Connect Repository to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `pratz456/Sandbox-Deploy`
4. Vercel will automatically detect it's a Next.js project

## Step 2: Configure Environment Variables

In your Vercel project settings, add the following environment variables:

### Firebase Configuration (Client-side)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Firebase Admin (Server-side)
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Plaid Configuration
- `PLAID_ENV` (set to "sandbox" for testing)
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

### OpenAI Configuration
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to "gpt-4o-mini")

### Custom Configuration
- `CUSTOM_KEY`

## Step 3: Build Settings

Vercel will automatically detect the following settings from your project:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## Step 4: Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Your app will be available at the provided Vercel URL

## Step 5: Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS settings as instructed

## Environment-Specific Deployments

### Production
- Set `PLAID_ENV` to `production`
- Use production Firebase project
- Use production OpenAI API key

### Preview/Development
- Set `PLAID_ENV` to `sandbox`
- Use development Firebase project
- Use development OpenAI API key

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all environment variables are set
   - Ensure Firebase private key is properly formatted with `\n` for newlines

2. **Runtime Errors**
   - Check Vercel function logs in the dashboard
   - Verify API routes are working correctly

3. **Environment Variables**
   - Make sure all required variables are set
   - Check that private keys are properly escaped

### Support

- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Next.js on Vercel: [vercel.com/docs/frameworks/nextjs](https://vercel.com/docs/frameworks/nextjs)

## Post-Deployment Checklist

- [ ] Test authentication flow
- [ ] Test Plaid integration
- [ ] Test OpenAI analysis
- [ ] Verify all API routes work
- [ ] Check error logging
- [ ] Test on mobile devices
- [ ] Set up monitoring/alerts
