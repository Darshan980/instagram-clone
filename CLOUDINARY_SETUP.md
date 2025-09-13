# Cloudinary Setup Guide

## The Issue
You're getting the error: `Create post error: { message: 'Invalid api_key your-api-key', name: 'Error', http_code: 401 }`

This happens because Cloudinary credentials are not properly configured in your backend.

## Quick Fix (Temporary)
The backend has been updated to work without Cloudinary by using placeholder images. You can now create posts, but they will show placeholder images instead of your actual uploaded images.

## Permanent Solution: Set up Cloudinary

### Step 1: Create a Cloudinary Account
1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get Your Credentials
1. After logging in, go to your Dashboard
2. You'll see your account details:
   - **Cloud Name** (e.g., `dxyz123abc`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### Step 3: Update Your .env File
1. Open `insta-backend/.env`
2. Replace the placeholder values with your actual credentials:

```env
# Replace these with your actual Cloudinary credentials
CLOUDINARY_CLOUD_NAME=your-actual-cloud-name
CLOUDINARY_API_KEY=your-actual-api-key
CLOUDINARY_API_SECRET=your-actual-api-secret
```

### Step 4: Restart Your Backend Server
1. Stop the backend server (Ctrl+C)
2. Start it again: `npm run dev` or `node server.js`
3. You should see: `✅ Cloudinary configured successfully`

## Testing
1. Try creating a new post with an image
2. The image should now upload to Cloudinary instead of showing a placeholder
3. You can view your uploaded images in your Cloudinary dashboard

## Free Tier Limits
Cloudinary's free tier includes:
- 25 GB storage
- 25 GB monthly bandwidth
- 1,000 transformations per month

This is more than enough for development and small projects.

## Troubleshooting

### Still getting API key errors?
- Double-check that you copied the credentials correctly
- Make sure there are no extra spaces in the .env file
- Ensure you restarted the server after updating the .env file

### Images not uploading?
- Check the server console for error messages
- Verify your Cloudinary account is active
- Make sure you're within the free tier limits

### Need help?
- Check the Cloudinary documentation: [https://cloudinary.com/documentation](https://cloudinary.com/documentation)
- The backend will show helpful messages in the console about Cloudinary status

## Alternative: Continue Without Cloudinary
If you don't want to set up Cloudinary right now, the app will continue to work with placeholder images. All other features (likes, comments, user authentication) work normally.